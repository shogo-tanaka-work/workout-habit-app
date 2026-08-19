import type {
  BodyLog,
  BodyPart,
  Exercise,
  Template,
  TemplateExercise,
  TrainingPhase,
  UserExerciseSetting,
  UserProfile,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import type {
  BodyLogRow,
  BodyPartRow,
  ExerciseRow,
  TrainingPhaseRow,
  UserExerciseSettingRow,
  UserProfileRow,
  TemplateExerciseRow,
  TemplateRow,
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

export const toUserExerciseSetting = (row: UserExerciseSettingRow): UserExerciseSetting => ({
  id: row.id,
  exerciseId: row.exercise_id,
  restSeconds: row.rest_seconds,
  barWeightKg: row.bar_weight_kg,
  // 0/1 と NULL を保つ（NULL は「上書きしない」）。
  isArchived: row.is_archived === null ? null : row.is_archived === 1,
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

export const toBodyLog = (row: BodyLogRow): BodyLog => ({
  id: row.id,
  measuredAt: row.measured_at,
  bodyWeightKg: row.body_weight_kg,
  bodyFatPercentage: row.body_fat_percentage,
  memo: row.memo,
});

export const toUserProfile = (row: UserProfileRow): UserProfile => ({
  id: row.id,
  trainingGoal: row.training_goal,
  heightCm: row.height_cm,
  gymMonthlyFeeYen: row.gym_monthly_fee_yen,
  note: row.note,
});

export const toTrainingPhase = (row: TrainingPhaseRow): TrainingPhase => ({
  id: row.id,
  phase: row.phase,
  startedOn: row.started_on,
  endedOn: row.ended_on,
  note: row.note,
});

export const toTemplate = (row: TemplateRow): Template => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

export const toTemplateExercise = (row: TemplateExerciseRow): TemplateExercise => ({
  id: row.id,
  templateId: row.template_id,
  exerciseId: row.exercise_id,
  orderIndex: row.order_index,
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
