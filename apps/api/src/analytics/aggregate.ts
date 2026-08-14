import type { AuthenticatedUser } from '../auth/types';
import { scopeForExercise, scopeForUser } from '../db/scope';
import { DAYS_PER_WEEK, shiftIsoDate, weekStartIso } from '../utils/isoDate';
import { countedSetsCondition, COMPLETED_WORKOUT_STATUS, rmDivisorSql } from './sql';

// 記録の取得と、期間キーごとの集計。**HTTP を知らない純粋な処理**にして、
// route からは「取得 → 集計 → JSON 化」の3手順として呼べるようにする。


export const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

// 完了済みワークアウト1件ごとの集計行（日付つき）。
export type WorkoutAggregateRow = {
  date: string;
  sets: number;
  volume: number | null;
  reps: number | null;
};

export type PeriodSummary = {
  workoutCount: number;
  setCount: number;
  totalVolume: number;
  totalReps: number;
};

export const emptyPeriodSummary = (): PeriodSummary => ({
  workoutCount: 0,
  setCount: 0,
  totalVolume: 0,
  totalReps: 0,
});

export const loadWorkoutAggregates = async (
  database: D1Database,
  since: string,
  user: AuthenticatedUser,
): Promise<WorkoutAggregateRow[]> => {
  const scope = scopeForUser(user, 'w.user_id');
  const result = await database
    .prepare(
      `SELECT w.performed_at AS date,
              COUNT(s.id) AS sets,
              SUM(s.weight_kg * s.reps) AS volume,
              SUM(s.reps) AS reps
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN workout_sets s ON s.workout_exercise_id = we.id AND ${countedSetsCondition('s')}
       WHERE w.status = '${COMPLETED_WORKOUT_STATUS}' AND w.performed_at >= ? AND ${scope.condition}
       GROUP BY w.id
       ORDER BY w.performed_at`,
    )
    .bind(since, ...scope.params)
    .all<WorkoutAggregateRow>();
  return result.results;
};

// 部位ごとの期間合計。並びはボリューム降順（同値は部位名順）。
// exercises は部位内の種目別内訳（ボリューム降順）。積み上げバーの区分に使う。
export type BodyPartExerciseTotal = {
  exerciseId: string;
  name: string;
  setCount: number;
  totalVolume: number;
};

export type BodyPartTotal = {
  bodyPartId: string;
  name: string;
  setCount: number;
  totalVolume: number;
  totalReps: number;
  exercises: BodyPartExerciseTotal[];
};

export const loadBodyPartTotals = async (
  database: D1Database,
  since: string,
  user: AuthenticatedUser,
): Promise<BodyPartTotal[]> => {
  type BodyPartTotalRow = {
    body_part_id: string;
    body_part_name: string;
    sets: number;
    volume: number | null;
    reps: number | null;
  };
  type BodyPartExerciseRow = {
    body_part_id: string;
    exercise_id: string;
    exercise_name: string;
    sets: number;
    volume: number | null;
  };
  const scope = scopeForUser(user, 'w.user_id');
  const totalsStatement = database
    .prepare(
      `SELECT COALESCE(bp.id, 'unknown') AS body_part_id,
              COALESCE(bp.name, '未分類') AS body_part_name,
              COUNT(s.id) AS sets,
              SUM(s.weight_kg * s.reps) AS volume,
              SUM(s.reps) AS reps
       FROM workout_sets s
       JOIN workout_exercises we ON s.workout_exercise_id = we.id
       JOIN workouts w ON we.workout_id = w.id
       JOIN exercises e ON we.exercise_id = e.id
       LEFT JOIN body_parts bp ON e.primary_body_part_id = bp.id
       WHERE w.status = '${COMPLETED_WORKOUT_STATUS}' AND ${countedSetsCondition('s')}
         AND w.performed_at >= ? AND ${scope.condition}
       GROUP BY bp.id
       ORDER BY volume DESC, body_part_name`,
    )
    .bind(since, ...scope.params);
  const exercisesStatement = database
    .prepare(
      `SELECT COALESCE(bp.id, 'unknown') AS body_part_id,
              e.id AS exercise_id,
              e.name AS exercise_name,
              COUNT(s.id) AS sets,
              SUM(s.weight_kg * s.reps) AS volume
       FROM workout_sets s
       JOIN workout_exercises we ON s.workout_exercise_id = we.id
       JOIN workouts w ON we.workout_id = w.id
       JOIN exercises e ON we.exercise_id = e.id
       LEFT JOIN body_parts bp ON e.primary_body_part_id = bp.id
       WHERE w.status = '${COMPLETED_WORKOUT_STATUS}' AND ${countedSetsCondition('s')}
         AND w.performed_at >= ? AND ${scope.condition}
       GROUP BY bp.id, e.id
       ORDER BY volume DESC, exercise_name`,
    )
    .bind(since, ...scope.params);

  // 独立した2クエリを1往復にまとめる（loadDailySummary と同じ理由の境界型付け）。
  const [totalsResult, exercisesResult] = (await database.batch([
    totalsStatement,
    exercisesStatement,
  ])) as [D1Result<BodyPartTotalRow>, D1Result<BodyPartExerciseRow>];

  // 種目内訳はボリューム降順で並んでいるため、部位ごとに振り分けても降順が保たれる。
  const exercisesByBodyPart = new Map<string, BodyPartExerciseTotal[]>();
  for (const row of exercisesResult.results) {
    const entries = exercisesByBodyPart.get(row.body_part_id) ?? [];
    entries.push({
      exerciseId: row.exercise_id,
      name: row.exercise_name,
      setCount: row.sets,
      totalVolume: row.volume ?? 0,
    });
    exercisesByBodyPart.set(row.body_part_id, entries);
  }

  return totalsResult.results.map((row) => ({
    bodyPartId: row.body_part_id,
    name: row.body_part_name,
    setCount: row.sets,
    totalVolume: row.volume ?? 0,
    totalReps: row.reps ?? 0,
    exercises: exercisesByBodyPart.get(row.body_part_id) ?? [],
  }));
};

// 日別サマリ（ヒートマップ用）と全期間の累計回数。
// topBodyPartId はその日の最大ボリューム部位（ヒートマップの色分け用）。
// 集計対象のセットが無い日は null、部位未設定の種目しか無い日は 'unknown'。
export type DailySummary = {
  date: string;
  workoutCount: number;
  setCount: number;
  totalVolume: number;
  topBodyPartId: string | null;
};

export const loadDailySummary = async (
  database: D1Database,
  since: string,
  user: AuthenticatedUser,
): Promise<{ totalWorkouts: number; days: DailySummary[] }> => {
  type DailyRow = { date: string; workouts: number; sets: number; volume: number | null };
  type TotalRow = { workouts: number };
  type DailyBodyPartRow = { date: string; body_part_id: string; volume: number | null };
  const scope = scopeForUser(user, 'w.user_id');
  const dailyStatement = database
    .prepare(
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
    .bind(since, ...scope.params);
  const totalScope = scopeForUser(user, 'user_id');
  const totalStatement = database
    .prepare(
      `SELECT COUNT(*) AS workouts FROM workouts
       WHERE status = '${COMPLETED_WORKOUT_STATUS}' AND ${totalScope.condition}`,
    )
    .bind(...totalScope.params);
  // 日×部位のボリューム。日ごとにボリューム降順で返し、先頭行をその日の最大部位として使う。
  // 同値の並びが実行ごとに揺れないよう body_part_id で並びを固定する。
  const dailyBodyPartStatement = database
    .prepare(
      `SELECT w.performed_at AS date,
              COALESCE(bp.id, 'unknown') AS body_part_id,
              SUM(s.weight_kg * s.reps) AS volume
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN workout_sets s ON s.workout_exercise_id = we.id AND ${countedSetsCondition('s')}
       JOIN exercises e ON we.exercise_id = e.id
       LEFT JOIN body_parts bp ON e.primary_body_part_id = bp.id
       WHERE w.status = '${COMPLETED_WORKOUT_STATUS}' AND w.performed_at >= ? AND ${scope.condition}
       GROUP BY w.performed_at, bp.id
       ORDER BY w.performed_at, volume DESC, body_part_id`,
    )
    .bind(since, ...scope.params);

  // 独立した3クエリを1往復にまとめる。batch() の結果はステートメント順で返る。
  // batch は型引数を1つしか取れないため、境界の型付けは all<T>() と同じ扱いでここで行う。
  const [dailyResult, totalResult, dailyBodyPartResult] = (await database.batch([
    dailyStatement,
    totalStatement,
    dailyBodyPartStatement,
  ])) as [D1Result<DailyRow>, D1Result<TotalRow>, D1Result<DailyBodyPartRow>];

  // 日ごとの先頭行（ボリューム降順の1件目）だけを採る。
  const topBodyPartByDate = new Map<string, string>();
  for (const row of dailyBodyPartResult.results) {
    if (!topBodyPartByDate.has(row.date)) {
      topBodyPartByDate.set(row.date, row.body_part_id);
    }
  }

  return {
    totalWorkouts: totalResult.results[0]?.workouts ?? 0,
    days: dailyResult.results.map((row) => ({
      date: row.date,
      workoutCount: row.workouts,
      setCount: row.sets,
      totalVolume: roundToOneDecimal(row.volume ?? 0),
      topBodyPartId: topBodyPartByDate.get(row.date) ?? null,
    })),
  };
};

// ボディログ（体重・体脂肪率）。測定日昇順。
export type BodyLogPoint = {
  date: string;
  bodyWeightKg: number | null;
  bodyFatPercentage: number | null;
};

export const loadBodyLogs = async (
  database: D1Database,
  since: string,
  user: AuthenticatedUser,
): Promise<BodyLogPoint[]> => {
  type BodyLogRow = {
    measured_at: string;
    body_weight_kg: number | null;
    body_fat_percentage: number | null;
  };
  const scope = scopeForUser(user, 'user_id');
  const result = await database
    .prepare(
      `SELECT measured_at, body_weight_kg, body_fat_percentage
       FROM body_logs
       WHERE measured_at >= ? AND ${scope.condition}
       ORDER BY measured_at`,
    )
    .bind(since, ...scope.params)
    .all<BodyLogRow>();
  return result.results.map((row) => ({
    date: row.measured_at.slice(0, 10),
    bodyWeightKg: row.body_weight_kg,
    bodyFatPercentage: row.body_fat_percentage,
  }));
};

// 種目ごとの実施回数・最終実施日・ベスト推定1RM。実施回数降順（同数は名前順）。
export type ExerciseSummary = {
  id: string;
  name: string;
  bodyPartName: string;
  sessionCount: number;
  lastPerformedAt: string | null;
  bestOneRepMax: number;
};

export const loadExerciseSummaries = async (
  database: D1Database,
  user: AuthenticatedUser,
): Promise<ExerciseSummary[]> => {
  type ExerciseListRow = {
    id: string;
    name: string;
    body_part_name: string;
    session_count: number;
    last_performed_at: string | null;
    best_one_rep_max: number | null;
  };
  const workoutScope = scopeForUser(user, 'w.user_id');
  const exerciseScope = scopeForExercise(user, 'e.owner_user_id');
  const result = await database
    .prepare(
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
  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    bodyPartName: row.body_part_name,
    sessionCount: row.session_count,
    lastPerformedAt: row.last_performed_at,
    bestOneRepMax: row.best_one_rep_max ?? 0,
  }));
};

// 習慣化ステータスの材料。日ごとの完了回数と、全期間の最終実施日。
export type HabitCounts = {
  dailyCounts: { date: string; workouts: number }[];
  lastWorkoutDate: string | null;
};

export const loadHabitCounts = async (
  database: D1Database,
  since: string,
  user: AuthenticatedUser,
): Promise<HabitCounts> => {
  type CountRow = { date: string; workouts: number };
  type LastRow = { last_date: string | null };
  const scope = scopeForUser(user, 'user_id');
  const countsStatement = database
    .prepare(
      `SELECT performed_at AS date, COUNT(*) AS workouts
       FROM workouts
       WHERE status = '${COMPLETED_WORKOUT_STATUS}' AND performed_at >= ? AND ${scope.condition}
       GROUP BY performed_at`,
    )
    .bind(since, ...scope.params);
  const lastStatement = database
    .prepare(
      `SELECT MAX(performed_at) AS last_date FROM workouts
       WHERE status = '${COMPLETED_WORKOUT_STATUS}' AND ${scope.condition}`,
    )
    .bind(...scope.params);

  // 独立した2クエリを1往復にまとめる（loadDailySummary と同じ理由の境界型付け）。
  const [countsResult, lastResult] = (await database.batch([countsStatement, lastStatement])) as [
    D1Result<CountRow>,
    D1Result<LastRow>,
  ];
  return {
    dailyCounts: countsResult.results,
    lastWorkoutDate: lastResult.results[0]?.last_date ?? null,
  };
};

// 週ごとの記録状況と連続週数（今週が未記録でも進行中として扱う）。
export type HabitSummary = {
  currentWeekStart: string;
  thisWeekCount: number;
  currentStreakWeeks: number;
  activeWeeks: number;
  totalWeeks: number;
  averageWorkoutsPerWeek: number;
  weeks: { weekStart: string; workoutCount: number }[];
};

export const summarizeHabitWeeks = (
  dailyCounts: readonly { date: string; workouts: number }[],
  period: { since: string; today: string },
): HabitSummary => {
  const currentWeekStart = weekStartIso(period.today);

  const countByWeek = new Map<string, number>();
  for (const row of dailyCounts) {
    const weekStart = weekStartIso(row.date);
    countByWeek.set(weekStart, (countByWeek.get(weekStart) ?? 0) + row.workouts);
  }

  // since から今週まで欠けなく週の配列を作る（記録なしの週は 0）。
  const weekSeries: { weekStart: string; workoutCount: number }[] = [];
  for (
    let cursor = period.since;
    cursor <= currentWeekStart;
    cursor = shiftIsoDate(cursor, DAYS_PER_WEEK)
  ) {
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
  return {
    currentWeekStart,
    thisWeekCount: countByWeek.get(currentWeekStart) ?? 0,
    currentStreakWeeks: streakWeeks,
    activeWeeks,
    totalWeeks: weekSeries.length,
    averageWorkoutsPerWeek: roundToOneDecimal(totalWorkouts / weekSeries.length),
    weeks: weekSeries,
  };
};

// ワークアウト集計行を期間キー（週開始日や月）ごとにまとめる。
export const summarizeByPeriod = (
  rows: WorkoutAggregateRow[],
  periodKeyOf: (date: string) => string,
): Map<string, PeriodSummary> => {
  const byPeriod = new Map<string, PeriodSummary>();
  for (const row of rows) {
    const key = periodKeyOf(row.date);
    const entry = byPeriod.get(key) ?? emptyPeriodSummary();
    entry.workoutCount += 1;
    entry.setCount += row.sets;
    entry.totalVolume += row.volume ?? 0;
    entry.totalReps += row.reps ?? 0;
    byPeriod.set(key, entry);
  }
  return byPeriod;
};
