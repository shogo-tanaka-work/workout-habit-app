// SQLite のスキーマ定義（DDL）。アプリ起動時に execAsync で一括適用する。
// CREATE TABLE IF NOT EXISTS なので既存データを壊さず再実行できる。
export const SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
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
`;
