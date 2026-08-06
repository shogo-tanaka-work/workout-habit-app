-- workout-habit-api D1 スキーマ。
-- モバイル側（apps/mobile/src/db/schema.ts）のテーブル構成をミラーする。
-- 端末ローカル設定である app_settings は同期対象外のため持たない。

CREATE TABLE IF NOT EXISTS body_parts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  primary_body_part_id TEXT NOT NULL,
  default_rest_seconds INTEGER NOT NULL,
  default_bar_weight_kg REAL NOT NULL,
  category TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY NOT NULL,
  performed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  last_saved_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  rest_seconds_override INTEGER,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id TEXT PRIMARY KEY NOT NULL,
  workout_exercise_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  rpe REAL NOT NULL,
  is_warmup INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  memo TEXT NOT NULL DEFAULT '',
  rest_seconds INTEGER NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timer_events (
  id TEXT PRIMARY KEY NOT NULL,
  workout_set_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  sound_enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS template_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS body_logs (
  id TEXT PRIMARY KEY NOT NULL,
  measured_at TEXT NOT NULL UNIQUE,
  body_weight_kg REAL NOT NULL,
  body_fat_percentage REAL,
  estimated_calories_burned REAL,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
