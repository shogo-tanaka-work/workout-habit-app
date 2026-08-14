// 種目別の目標重量（exercise_goals）の読み出し。
// 書き込みは POST /sync/operations が受け持つため、ここは取得だけを持つ。

import type { AuthenticatedUser } from '../auth/types';
import { scopeForUser } from '../db/scope';

export type ExerciseGoalEntry = {
  exerciseId: string;
  targetWeightKg: number;
  memo: string;
  updatedAt: string;
};

/** 本人の目標を種目 ID 順で返す（UNIQUE(user_id, exercise_id) のため1種目1件）。 */
export const loadExerciseGoals = async (
  database: D1Database,
  user: AuthenticatedUser,
): Promise<ExerciseGoalEntry[]> => {
  type GoalRow = {
    exercise_id: string;
    target_weight_kg: number;
    memo: string;
    updated_at: string;
  };
  const scope = scopeForUser(user, 'user_id');
  const result = await database
    .prepare(
      `SELECT exercise_id, target_weight_kg, memo, updated_at
       FROM exercise_goals
       WHERE ${scope.condition}
       ORDER BY exercise_id`,
    )
    .bind(...scope.params)
    .all<GoalRow>();
  return result.results.map((row) => ({
    exerciseId: row.exercise_id,
    targetWeightKg: row.target_weight_kg,
    memo: row.memo,
    updatedAt: row.updated_at,
  }));
};
