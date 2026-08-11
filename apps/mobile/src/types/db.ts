// SQLite のテーブル行をそのまま受ける型。snake_case。
// ドメイン型（./domain.ts）への変換は src/db/mappers.ts に集約している。

export type BodyPartRow = {
  id: string;
  name: string;
  order_index: number;
};

export type ExerciseRow = {
  id: string;
  name: string;
  primary_body_part_id: string;
  default_rest_seconds: number;
  default_bar_weight_kg: number;
  category: string;
  is_archived: number;
};

export type UserExerciseSettingRow = {
  id: string;
  exercise_id: string;
  // NULL は「上書きしない」。
  rest_seconds: number | null;
  bar_weight_kg: number | null;
  is_archived: number | null;
};

export type WorkoutRow = {
  id: string;
  performed_at: string;
  // planned は Claude Code が書いた予定。端末が開始すると active になる。
  status: 'planned' | 'active' | 'completed';
  memo: string;
  last_saved_at: string;
  created_at: string;
};

export type WorkoutExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  rest_seconds_override: number | null;
  memo: string;
};

export type WorkoutSetRow = {
  id: string;
  workout_exercise_id: string;
  order_index: number;
  weight_kg: number;
  reps: number;
  rpe: number;
  is_warmup: number;
  is_completed: number;
  memo: string;
  rest_seconds: number;
  deleted_at: string | null;
};

export type TemplateRow = {
  id: string;
  name: string;
  created_at: string;
};

export type TemplateExerciseRow = {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
};

export type AppSettingRow = {
  key: string;
  value: string;
};

export type BodyLogRow = {
  id: string;
  measured_at: string;
  body_weight_kg: number;
  body_fat_percentage: number | null;
  memo: string;
};
