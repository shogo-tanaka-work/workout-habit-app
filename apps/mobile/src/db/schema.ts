// SQLite のスキーマ定義（DDL）。アプリ起動時に execAsync で一括適用する。
// CREATE TABLE IF NOT EXISTS なので既存データを壊さず再実行できる。
//
// PRAGMA journal_mode = WAL はここに書かない。この SQL は migration v1 として
// withTransactionAsync の中で実行されるが、SQLite はトランザクション中の WAL 化を
// エラーにするため、新規インストールの初期化が失敗する。
// WAL 化は接続セットアップ（hooks/useWorkoutStore.ts）でトランザクション外に行う。
export const SCHEMA_SQL = `
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
  CREATE TABLE IF NOT EXISTS user_exercise_settings (
    id TEXT PRIMARY KEY NOT NULL,
    exercise_id TEXT NOT NULL,
    rest_seconds INTEGER,
    bar_weight_kg REAL,
    is_archived INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (exercise_id)
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
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sync_outbox (
    id TEXT PRIMARY KEY NOT NULL,
    entity TEXT NOT NULL,
    op TEXT NOT NULL,
    row_id TEXT NOT NULL,
    payload TEXT,
    occurred_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sync_outbox_occurred_at ON sync_outbox(occurred_at);
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
  CREATE TABLE IF NOT EXISTS weekly_feedback (
    id TEXT PRIMARY KEY NOT NULL,
    week_start TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (week_start)
  );
  CREATE TABLE IF NOT EXISTS training_phases (
    id TEXT PRIMARY KEY NOT NULL,
    phase TEXT NOT NULL,
    started_on TEXT NOT NULL,
    ended_on TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (started_on)
  );
  CREATE TABLE IF NOT EXISTS exercise_goals (
    id TEXT PRIMARY KEY NOT NULL,
    exercise_id TEXT NOT NULL REFERENCES exercises(id),
    target_weight_kg REAL NOT NULL,
    memo TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (exercise_id)
  );
  CREATE INDEX IF NOT EXISTS idx_workout_sets_workout_exercise_id
    ON workout_sets(workout_exercise_id);
  CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id
    ON workout_exercises(workout_id);
  CREATE INDEX IF NOT EXISTS idx_workouts_status_performed_at
    ON workouts(status, performed_at);
  CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity_row_id
    ON sync_outbox(entity, row_id);
`;
