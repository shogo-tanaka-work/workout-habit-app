import { Hono } from 'hono';

import { scopeForExercise, scopeForUser } from '../db/scope';
import type { AppEnv } from '../env';
import {
  loadBodyPartTotals,
  loadWorkoutAggregates,
  roundToOneDecimal,
  summarizeByPeriod,
} from '../analytics/aggregate';
import { monthlyPeriod, weeklyPeriod } from '../analytics/period';
import { countedSetsCondition, COMPLETED_WORKOUT_STATUS, rmDivisorSql } from '../analytics/sql';
import { DAYS_PER_WEEK, monthOf, shiftIsoDate, weekStartIso } from '../utils/isoDate';

// 読み取り専用の集計 API。
//
// route が持つのは「入力の解釈 → 取得・集計の呼び出し → JSON 化」だけ。
// 期間の解釈は analytics/period.ts、SQL の条件は analytics/sql.ts、
// 集計は analytics/aggregate.ts が持つ。
//
// **ウォームアップ（is_warmup = 1）は集計に入れない。** UI で WU を指定できるのに
// 総ボリュームへ算入されると、軽い準備セットを足すほど数字が実態から離れる。
// モバイル側 utils/aggregate.ts も同じ規則。片方だけ変えない。
// 行スコープはロールに関わらず本人の記録だけ（src/db/scope.ts）。

export const analytics = new Hono<AppEnv>();

// 週次サマリ: 直近 N 週（月曜はじまり）の記録回数・セット数・ボリューム・レップ数。
analytics.get('/weekly', async (context) => {
  const { today, since } = weeklyPeriod(context.req.query(), 12);
  const rows = await loadWorkoutAggregates(context.env.DB, since, context.get('user'));
  const byWeek = summarizeByPeriod(rows, weekStartIso);
  const series = [...byWeek.entries()]
    .map(([weekStart, summary]) => ({ weekStart, ...summary }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return context.json({ today, since, weeks: series });
});

// 月次サマリ: 直近 N か月の記録回数・セット数・ボリューム・レップ数。
analytics.get('/monthly', async (context) => {
  const { today, since } = monthlyPeriod(context.req.query(), 12);
  const rows = await loadWorkoutAggregates(context.env.DB, since, context.get('user'));
  const byMonth = summarizeByPeriod(rows, monthOf);
  const series = [...byMonth.entries()]
    .map(([month, summary]) => ({ month, ...summary }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return context.json({ today, since, months: series });
});

// 部位別ボリューム: 直近 N 週の期間合計を部位ごとに返す（ボリューム降順）。
// 週ごとの内訳は返さない（クライアントに期間合算を再実装させない）。
analytics.get('/body-parts', async (context) => {
  const { today, since } = weeklyPeriod(context.req.query(), 8);
  const bodyParts = await loadBodyPartTotals(context.env.DB, since, context.get('user'));
  return context.json({ today, since, bodyParts });
});

// 日別サマリ: 直近 N 週の日ごとの記録回数・セット数・ボリューム（ヒートマップ用）と全期間の累計回数。
analytics.get('/daily', async (context) => {
  const { today, since } = weeklyPeriod(context.req.query(), 16);

  type DailyRow = {
    date: string;
    workouts: number;
    sets: number;
    volume: number | null;
  };
  const scope = scopeForUser(context.get('user'), 'w.user_id');
  const result = await context.env.DB.prepare(
    `SELECT w.performed_at AS date,
            COUNT(DISTINCT w.id) AS workouts,
            COUNT(s.id) AS sets,
            SUM(s.weight_kg * s.reps) AS volume
     FROM workouts w
     JOIN workout_exercises we ON we.workout_id = w.id
     JOIN workout_sets s ON s.workout_exercise_id = we.id AND ${countedSetsCondition('s')}
     WHERE w.status = '${COMPLETED_WORKOUT_STATUS}' AND w.performed_at >= ? AND ${scope.condition}
     GROUP BY w.performed_at
     ORDER BY w.performed_at`,
  )
    .bind(since, ...scope.params)
    .all<DailyRow>();
  const totalScope = scopeForUser(context.get('user'), 'user_id');
  const total = await context.env.DB.prepare(
    `SELECT COUNT(*) AS workouts FROM workouts
     WHERE status = '${COMPLETED_WORKOUT_STATUS}' AND ${totalScope.condition}`,
  )
    .bind(...totalScope.params)
    .first<{ workouts: number }>();

  return context.json({
    today,
    since,
    totalWorkouts: total?.workouts ?? 0,
    days: result.results.map((row) => ({
      date: row.date,
      workoutCount: row.workouts,
      setCount: row.sets,
      totalVolume: roundToOneDecimal(row.volume ?? 0),
    })),
  });
});

// ボディログ: 体重・体脂肪率の推移（測定日昇順）。
analytics.get('/body-logs', async (context) => {
  type BodyLogRow = {
    measured_at: string;
    body_weight_kg: number | null;
    body_fat_percentage: number | null;
  };
  const scope = scopeForUser(context.get('user'), 'user_id');
  const result = await context.env.DB.prepare(
    `SELECT measured_at, body_weight_kg, body_fat_percentage
     FROM body_logs
     WHERE ${scope.condition}
     ORDER BY measured_at`,
  )
    .bind(...scope.params)
    .all<BodyLogRow>();
  return context.json({
    bodyLogs: result.results.map((row) => ({
      date: row.measured_at.slice(0, 10),
      bodyWeightKg: row.body_weight_kg,
      bodyFatPercentage: row.body_fat_percentage,
    })),
  });
});

// 種目一覧: 種目ごとの実施回数・最終実施日・ベスト推定1RM（Epley式）。
analytics.get('/exercises', async (context) => {
  type ExerciseListRow = {
    id: string;
    name: string;
    body_part_name: string;
    session_count: number;
    last_performed_at: string | null;
    best_one_rep_max: number | null;
  };
  const user = context.get('user');
  const workoutScope = scopeForUser(user, 'w.user_id');
  const exerciseScope = scopeForExercise(user, 'e.owner_user_id');
  const result = await context.env.DB.prepare(
    `SELECT e.id,
            e.name,
            COALESCE(bp.name, '未分類') AS body_part_name,
            COUNT(DISTINCT w.id) AS session_count,
            MAX(w.performed_at) AS last_performed_at,
            ROUND(MAX(s.weight_kg * (1.0 + s.reps / ${rmDivisorSql('e.id')})), 1) AS best_one_rep_max
     FROM exercises e
     LEFT JOIN body_parts bp ON bp.id = e.primary_body_part_id
     LEFT JOIN workout_exercises we ON we.exercise_id = e.id
     LEFT JOIN workouts w
       ON w.id = we.workout_id AND w.status = '${COMPLETED_WORKOUT_STATUS}' AND ${workoutScope.condition}
     LEFT JOIN workout_sets s
       ON s.workout_exercise_id = we.id AND ${countedSetsCondition('s')} AND w.id IS NOT NULL
     WHERE e.is_archived = 0 AND ${exerciseScope.condition}
     GROUP BY e.id
     ORDER BY session_count DESC, e.name`,
  )
    .bind(...workoutScope.params, ...exerciseScope.params)
    .all<ExerciseListRow>();
  return context.json({
    exercises: result.results.map((row) => ({
      id: row.id,
      name: row.name,
      bodyPartName: row.body_part_name,
      sessionCount: row.session_count,
      lastPerformedAt: row.last_performed_at,
      bestOneRepMax: row.best_one_rep_max ?? 0,
    })),
  });
});

// 種目別分析: セッション（実施日）ごとのボリューム・推定1RM・レップ数の推移と期間サマリ。
analytics.get('/exercises/:exerciseId', async (context) => {
  const exerciseId = context.req.param('exerciseId');
  const { today, since } = monthlyPeriod(context.req.query(), 6);

  const user = context.get('user');
  const exerciseScope = scopeForExercise(user, 'owner_user_id');
  const exercise = await context.env.DB.prepare(
    `SELECT id, name FROM exercises WHERE id = ? AND ${exerciseScope.condition}`,
  )
    .bind(exerciseId, ...exerciseScope.params)
    .first<{ id: string; name: string }>();
  if (!exercise) {
    return context.json({ error: 'exercise not found' }, 404);
  }

  type SessionRow = {
    date: string;
    sets: number;
    volume: number | null;
    total_reps: number | null;
    max_reps: number | null;
    top_weight: number | null;
    best_one_rep_max: number | null;
  };
  const workoutScope = scopeForUser(user, 'w.user_id');
  const result = await context.env.DB.prepare(
    `SELECT w.performed_at AS date,
            COUNT(s.id) AS sets,
            SUM(s.weight_kg * s.reps) AS volume,
            SUM(s.reps) AS total_reps,
            MAX(s.reps) AS max_reps,
            MAX(s.weight_kg) AS top_weight,
            ROUND(MAX(s.weight_kg * (1.0 + s.reps / ${rmDivisorSql('we.exercise_id')})), 1) AS best_one_rep_max
     FROM workouts w
     JOIN workout_exercises we ON we.workout_id = w.id AND we.exercise_id = ?
     JOIN workout_sets s ON s.workout_exercise_id = we.id AND ${countedSetsCondition('s')}
     WHERE w.status = '${COMPLETED_WORKOUT_STATUS}' AND w.performed_at >= ? AND ${workoutScope.condition}
     GROUP BY w.id
     ORDER BY w.performed_at`,
  )
    .bind(exerciseId, since, ...workoutScope.params)
    .all<SessionRow>();

  const sessions = result.results.map((row) => ({
    date: row.date,
    setCount: row.sets,
    totalVolume: roundToOneDecimal(row.volume ?? 0),
    totalReps: row.total_reps ?? 0,
    maxReps: row.max_reps ?? 0,
    topWeightKg: row.top_weight ?? 0,
    bestOneRepMax: row.best_one_rep_max ?? 0,
  }));
  const summary = {
    sessionCount: sessions.length,
    setCount: sessions.reduce((sum, session) => sum + session.setCount, 0),
    totalVolume: roundToOneDecimal(sessions.reduce((sum, session) => sum + session.totalVolume, 0)),
    bestOneRepMax: sessions.reduce((max, session) => Math.max(max, session.bestOneRepMax), 0),
  };
  return context.json({ exercise, today, since, summary, sessions });
});

// 習慣化ステータス: 週ごとの記録状況と連続週数（今週が未記録でも進行中として扱う）。
analytics.get('/habit', async (context) => {
  const { today, since } = weeklyPeriod(context.req.query(), 12);
  const currentWeekStart = weekStartIso(today);

  const scope = scopeForUser(context.get('user'), 'user_id');
  const result = await context.env.DB.prepare(
    `SELECT performed_at AS date, COUNT(*) AS workouts
     FROM workouts
     WHERE status = '${COMPLETED_WORKOUT_STATUS}' AND performed_at >= ? AND ${scope.condition}
     GROUP BY performed_at`,
  )
    .bind(since, ...scope.params)
    .all<{ date: string; workouts: number }>();
  const lastWorkout = await context.env.DB.prepare(
    `SELECT MAX(performed_at) AS last_date FROM workouts
     WHERE status = '${COMPLETED_WORKOUT_STATUS}' AND ${scope.condition}`,
  )
    .bind(...scope.params)
    .first<{ last_date: string | null }>();

  const countByWeek = new Map<string, number>();
  for (const row of result.results) {
    const weekStart = weekStartIso(row.date);
    countByWeek.set(weekStart, (countByWeek.get(weekStart) ?? 0) + row.workouts);
  }

  // since から今週まで欠けなく週の配列を作る（記録なしの週は 0）。
  const weekSeries: { weekStart: string; workoutCount: number }[] = [];
  for (let cursor = since; cursor <= currentWeekStart; cursor = shiftIsoDate(cursor, DAYS_PER_WEEK)) {
    weekSeries.push({ weekStart: cursor, workoutCount: countByWeek.get(cursor) ?? 0 });
  }

  // 連続週数: 今週から遡って記録のある週を数える。今週が未記録の場合は進行中とみなしスキップ。
  let streakWeeks = 0;
  for (let index = weekSeries.length - 1; index >= 0; index -= 1) {
    const week = weekSeries[index];
    if (week.workoutCount > 0) {
      streakWeeks += 1;
      continue;
    }
    if (week.weekStart === currentWeekStart) {
      continue;
    }
    break;
  }

  const totalWorkouts = weekSeries.reduce((sum, week) => sum + week.workoutCount, 0);
  const activeWeeks = weekSeries.filter((week) => week.workoutCount > 0).length;
  return context.json({
    today,
    since,
    currentWeekStart,
    thisWeekCount: countByWeek.get(currentWeekStart) ?? 0,
    lastWorkoutDate: lastWorkout?.last_date ?? null,
    currentStreakWeeks: streakWeeks,
    activeWeeks,
    totalWeeks: weekSeries.length,
    averageWorkoutsPerWeek: roundToOneDecimal(totalWorkouts / weekSeries.length),
    weeks: weekSeries,
  });
});
