import { Hono } from 'hono';

// Phase 3 分析API。D1 のワークアウト記録を読み取り専用で集計する。
// 認証は親アプリ（src/index.ts）の Bearer トークンミドルウェアが担う。
// 日付はモバイル側が端末ローカル日付（YYYY-MM-DD）で保存しているため、
// 基準日をクライアントから `?today=YYYY-MM-DD` で渡せるようにする（省略時はUTC今日）。

const EPLEY_DIVISOR = 30;
const DAYS_PER_WEEK = 7;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatIsoDate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const parseIsoDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
};

// 月曜はじまりの週開始日（モバイル側 startOfWeekIso と同じ定義）。
const weekStartIso = (isoDate: string): string => {
  const date = parseIsoDate(isoDate);
  const daysSinceMonday = (date.getDay() + 6) % DAYS_PER_WEEK;
  date.setDate(date.getDate() - daysSinceMonday);
  return formatIsoDate(date);
};

const daysAgoIso = (today: string, days: number): string => {
  const date = parseIsoDate(today);
  date.setDate(date.getDate() - days);
  return formatIsoDate(date);
};

const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

const firstDayOfMonthsAgo = (today: string, monthsAgo: number): string => {
  const date = parseIsoDate(today);
  return formatIsoDate(new Date(date.getFullYear(), date.getMonth() - monthsAgo, 1));
};

const resolveToday = (todayParam: string | undefined): string =>
  todayParam && ISO_DATE_PATTERN.test(todayParam)
    ? todayParam
    : new Date().toISOString().slice(0, 10);

const clampInt = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const round1 = (value: number): number => Math.round(value * 10) / 10;

// 完了済みワークアウト1件ごとの集計行（日付つき）。
type WorkoutAggregateRow = {
  date: string;
  sets: number;
  volume: number | null;
  reps: number | null;
};

type PeriodSummary = {
  workoutCount: number;
  setCount: number;
  totalVolume: number;
  totalReps: number;
};

const emptyPeriodSummary = (): PeriodSummary => ({
  workoutCount: 0,
  setCount: 0,
  totalVolume: 0,
  totalReps: 0,
});

const loadWorkoutAggregates = async (
  database: D1Database,
  since: string,
): Promise<WorkoutAggregateRow[]> => {
  const result = await database
    .prepare(
      `SELECT w.performed_at AS date,
              COUNT(s.id) AS sets,
              SUM(s.weight_kg * s.reps) AS volume,
              SUM(s.reps) AS reps
       FROM workouts w
       JOIN workout_exercises we ON we.workout_id = w.id
       JOIN workout_sets s ON s.workout_exercise_id = we.id AND s.deleted_at IS NULL
       WHERE w.status = 'completed' AND w.performed_at >= ?
       GROUP BY w.id
       ORDER BY w.performed_at`,
    )
    .bind(since)
    .all<WorkoutAggregateRow>();
  return result.results;
};

// ワークアウト集計行を期間キー（週開始日や月）ごとにまとめる。
const summarizeByPeriod = (
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

export const analytics = new Hono<{ Bindings: Env }>();

// 週次サマリ: 直近 N 週（月曜はじまり）の記録回数・セット数・ボリューム・レップ数。
analytics.get('/weekly', async (context) => {
  const weeks = clampInt(context.req.query('weeks'), 12, 1, 53);
  const today = resolveToday(context.req.query('today'));
  const since = weekStartIso(daysAgoIso(today, (weeks - 1) * DAYS_PER_WEEK));
  const rows = await loadWorkoutAggregates(context.env.DB, since);
  const byWeek = summarizeByPeriod(rows, weekStartIso);
  const series = [...byWeek.entries()]
    .map(([weekStart, summary]) => ({ weekStart, ...summary }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return context.json({ today, since, weeks: series });
});

// 月次サマリ: 直近 N か月の記録回数・セット数・ボリューム・レップ数。
analytics.get('/monthly', async (context) => {
  const months = clampInt(context.req.query('months'), 12, 1, 36);
  const today = resolveToday(context.req.query('today'));
  const since = firstDayOfMonthsAgo(today, months - 1);
  const rows = await loadWorkoutAggregates(context.env.DB, since);
  const byMonth = summarizeByPeriod(rows, monthOf);
  const series = [...byMonth.entries()]
    .map(([month, summary]) => ({ month, ...summary }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return context.json({ today, since, months: series });
});

// 部位別ボリューム: 直近 N 週の週ごと×部位ごとの集計。
analytics.get('/body-parts', async (context) => {
  const weeks = clampInt(context.req.query('weeks'), 8, 1, 53);
  const today = resolveToday(context.req.query('today'));
  const since = weekStartIso(daysAgoIso(today, (weeks - 1) * DAYS_PER_WEEK));
  type BodyPartRow = {
    date: string;
    body_part_id: string;
    body_part_name: string;
    sets: number;
    volume: number | null;
    reps: number | null;
  };
  const result = await context.env.DB.prepare(
    `SELECT w.performed_at AS date,
            COALESCE(bp.id, 'unknown') AS body_part_id,
            COALESCE(bp.name, '未分類') AS body_part_name,
            COUNT(s.id) AS sets,
            SUM(s.weight_kg * s.reps) AS volume,
            SUM(s.reps) AS reps
     FROM workout_sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN workouts w ON we.workout_id = w.id
     JOIN exercises e ON we.exercise_id = e.id
     LEFT JOIN body_parts bp ON e.primary_body_part_id = bp.id
     WHERE w.status = 'completed' AND s.deleted_at IS NULL AND w.performed_at >= ?
     GROUP BY w.performed_at, bp.id
     ORDER BY w.performed_at`,
  )
    .bind(since)
    .all<BodyPartRow>();

  type BodyPartSummary = {
    bodyPartId: string;
    name: string;
    setCount: number;
    totalVolume: number;
    totalReps: number;
  };
  const byWeek = new Map<string, Map<string, BodyPartSummary>>();
  for (const row of result.results) {
    const weekStart = weekStartIso(row.date);
    const weekEntry = byWeek.get(weekStart) ?? new Map<string, BodyPartSummary>();
    const summary = weekEntry.get(row.body_part_id) ?? {
      bodyPartId: row.body_part_id,
      name: row.body_part_name,
      setCount: 0,
      totalVolume: 0,
      totalReps: 0,
    };
    summary.setCount += row.sets;
    summary.totalVolume += row.volume ?? 0;
    summary.totalReps += row.reps ?? 0;
    weekEntry.set(row.body_part_id, summary);
    byWeek.set(weekStart, weekEntry);
  }
  const series = [...byWeek.entries()]
    .map(([weekStart, parts]) => ({
      weekStart,
      bodyParts: [...parts.values()].sort((a, b) => b.totalVolume - a.totalVolume),
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return context.json({ today, since, weeks: series });
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
  const result = await context.env.DB.prepare(
    `SELECT e.id,
            e.name,
            COALESCE(bp.name, '未分類') AS body_part_name,
            COUNT(DISTINCT w.id) AS session_count,
            MAX(w.performed_at) AS last_performed_at,
            ROUND(MAX(s.weight_kg * (1.0 + s.reps / ${EPLEY_DIVISOR}.0)), 1) AS best_one_rep_max
     FROM exercises e
     LEFT JOIN body_parts bp ON bp.id = e.primary_body_part_id
     LEFT JOIN workout_exercises we ON we.exercise_id = e.id
     LEFT JOIN workouts w ON w.id = we.workout_id AND w.status = 'completed'
     LEFT JOIN workout_sets s
       ON s.workout_exercise_id = we.id AND s.deleted_at IS NULL AND w.id IS NOT NULL
     WHERE e.is_archived = 0
     GROUP BY e.id
     ORDER BY session_count DESC, e.name`,
  ).all<ExerciseListRow>();
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
  const months = clampInt(context.req.query('months'), 6, 1, 36);
  const today = resolveToday(context.req.query('today'));
  const since = firstDayOfMonthsAgo(today, months - 1);

  const exercise = await context.env.DB.prepare(
    'SELECT id, name FROM exercises WHERE id = ?',
  )
    .bind(exerciseId)
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
    best_one_rep_max: number | null;
  };
  const result = await context.env.DB.prepare(
    `SELECT w.performed_at AS date,
            COUNT(s.id) AS sets,
            SUM(s.weight_kg * s.reps) AS volume,
            SUM(s.reps) AS total_reps,
            MAX(s.reps) AS max_reps,
            ROUND(MAX(s.weight_kg * (1.0 + s.reps / ${EPLEY_DIVISOR}.0)), 1) AS best_one_rep_max
     FROM workouts w
     JOIN workout_exercises we ON we.workout_id = w.id AND we.exercise_id = ?
     JOIN workout_sets s ON s.workout_exercise_id = we.id AND s.deleted_at IS NULL
     WHERE w.status = 'completed' AND w.performed_at >= ?
     GROUP BY w.id
     ORDER BY w.performed_at`,
  )
    .bind(exerciseId, since)
    .all<SessionRow>();

  const sessions = result.results.map((row) => ({
    date: row.date,
    setCount: row.sets,
    totalVolume: round1(row.volume ?? 0),
    totalReps: row.total_reps ?? 0,
    maxReps: row.max_reps ?? 0,
    bestOneRepMax: row.best_one_rep_max ?? 0,
  }));
  const summary = {
    sessionCount: sessions.length,
    setCount: sessions.reduce((sum, session) => sum + session.setCount, 0),
    totalVolume: round1(sessions.reduce((sum, session) => sum + session.totalVolume, 0)),
    bestOneRepMax: sessions.reduce((max, session) => Math.max(max, session.bestOneRepMax), 0),
  };
  return context.json({ exercise, today, since, summary, sessions });
});

// 習慣化ステータス: 週ごとの記録状況と連続週数（今週が未記録でも進行中として扱う）。
analytics.get('/habit', async (context) => {
  const weeks = clampInt(context.req.query('weeks'), 12, 1, 53);
  const today = resolveToday(context.req.query('today'));
  const currentWeekStart = weekStartIso(today);
  const since = weekStartIso(daysAgoIso(today, (weeks - 1) * DAYS_PER_WEEK));

  const result = await context.env.DB.prepare(
    `SELECT performed_at AS date, COUNT(*) AS workouts
     FROM workouts
     WHERE status = 'completed' AND performed_at >= ?
     GROUP BY performed_at`,
  )
    .bind(since)
    .all<{ date: string; workouts: number }>();
  const lastWorkout = await context.env.DB.prepare(
    "SELECT MAX(performed_at) AS last_date FROM workouts WHERE status = 'completed'",
  ).first<{ last_date: string | null }>();

  const countByWeek = new Map<string, number>();
  for (const row of result.results) {
    const weekStart = weekStartIso(row.date);
    countByWeek.set(weekStart, (countByWeek.get(weekStart) ?? 0) + row.workouts);
  }

  // since から今週まで欠けなく週の配列を作る（記録なしの週は 0）。
  const weekSeries: { weekStart: string; workoutCount: number }[] = [];
  for (let cursor = since; cursor <= currentWeekStart; cursor = daysAgoIso(cursor, -DAYS_PER_WEEK)) {
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
    averageWorkoutsPerWeek: round1(totalWorkouts / weekSeries.length),
    weeks: weekSeries,
  });
});
