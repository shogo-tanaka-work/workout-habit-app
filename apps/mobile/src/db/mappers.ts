import type { BodyPart, Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import type {
  BodyPartRow,
  ExerciseRow,
  WorkoutRow,
  WorkoutExerciseRow,
  WorkoutSetRow,
} from '../types/db';

// SQLite の行（snake_case・数値フラグ）をドメイン型（camelCase・boolean）へ変換する。
// null 処理・boolean 変換・as の必要な箇所をこの1ファイルに集約する。

export const toBodyPart = (row: BodyPartRow): BodyPart => ({
  id: row.id,
  name: row.name,
  orderIndex: row.order_index,
});

export const toExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  name: row.name,
  primaryBodyPartId: row.primary_body_part_id,
  defaultRestSeconds: row.default_rest_seconds,
  defaultBarWeightKg: row.default_bar_weight_kg,
  category: row.category,
  isArchived: row.is_archived === 1,
});

export const toWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  performedAt: row.performed_at,
  status: row.status,
  memo: row.memo,
  lastSavedAt: row.last_saved_at,
  createdAt: row.created_at,
});

export const toWorkoutExercise = (row: WorkoutExerciseRow): WorkoutExercise => ({
  id: row.id,
  workoutId: row.workout_id,
  exerciseId: row.exercise_id,
  orderIndex: row.order_index,
  restSecondsOverride: row.rest_seconds_override,
  memo: row.memo,
});

export const toWorkoutSet = (row: WorkoutSetRow): WorkoutSet => ({
  id: row.id,
  workoutExerciseId: row.workout_exercise_id,
  orderIndex: row.order_index,
  weightKg: row.weight_kg,
  reps: row.reps,
  rpe: row.rpe,
  isWarmup: row.is_warmup === 1,
  isCompleted: row.is_completed === 1,
  memo: row.memo,
  restSeconds: row.rest_seconds,
  deletedAt: row.deleted_at,
});
