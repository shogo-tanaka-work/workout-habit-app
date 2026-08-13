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
