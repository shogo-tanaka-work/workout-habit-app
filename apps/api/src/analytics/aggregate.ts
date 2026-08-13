import type { AuthenticatedUser } from '../auth/types';
import { scopeForUser } from '../db/scope';
import { countedSetsCondition, COMPLETED_WORKOUT_STATUS } from './sql';

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
export type BodyPartTotal = {
  bodyPartId: string;
  name: string;
  setCount: number;
  totalVolume: number;
  totalReps: number;
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
  const scope = scopeForUser(user, 'w.user_id');
  const result = await database
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
    .bind(since, ...scope.params)
    .all<BodyPartTotalRow>();
  return result.results.map((row) => ({
    bodyPartId: row.body_part_id,
    name: row.body_part_name,
    setCount: row.sets,
    totalVolume: row.volume ?? 0,
    totalReps: row.reps ?? 0,
  }));
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
