-- Step 4: マルチユーザー化のためのテーブル再構築。
--
-- SQLite には ALTER TABLE ADD CONSTRAINT が無いため、外部キー・複合ユニークの追加は
-- 「旧テーブルをリネーム → 新テーブル作成 → INSERT SELECT → 旧テーブル DROP」で行う。
-- user_id 追加・外部キー・インデックスを 1 回の移行にまとめる（roadmap.md の残タスク）。
--
-- 所有関係の方針:
--   body_parts  … 全ユーザー共有のマスタ。user_id を持たない（変更なし）
--   exercises   … owner_user_id が NULL ならプリセット、非 NULL ならそのユーザーのカスタム種目
--   それ以外    … user_id NOT NULL。親から辿れる子テーブルにも持たせ、
--                 スコープ適用（WHERE user_id = ?）を 1 か所に集約できるようにする
--
-- 既存データはすべて所有者（admin）へ紐付ける。email は公開リポジトリへ書けないため
-- プレースホルダで作成し、デプロイ後に本人のアドレスへ更新する（手順は auth-model.md）。

PRAGMA defer_foreign_keys = true;

-- ---------------------------------------------------------------------------
-- 1. 旧テーブルの退避（body_parts は構成が変わらないためそのまま）
-- ---------------------------------------------------------------------------

ALTER TABLE exercises RENAME TO exercises_old;
ALTER TABLE workouts RENAME TO workouts_old;
ALTER TABLE workout_exercises RENAME TO workout_exercises_old;
ALTER TABLE workout_sets RENAME TO workout_sets_old;
ALTER TABLE timer_events RENAME TO timer_events_old;
ALTER TABLE templates RENAME TO templates_old;
ALTER TABLE template_exercises RENAME TO template_exercises_old;
ALTER TABLE body_logs RENAME TO body_logs_old;

-- ---------------------------------------------------------------------------
-- 2. 認証・認可のテーブル
-- ---------------------------------------------------------------------------

-- 認証（誰か）の結果を認可（使ってよいか）へ変換する行。ここに行が無ければ 403。
-- google_sub は招待時点では未知のため NULL 許容。初回ログインで書き込む。
CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Claude Code（CLI）用のトークン。ブラウザリダイレクトを持たないクライアント向け。
-- 平文は保存せず SHA-256 の hex だけを持つ。失効は revoked_at で行い、行は消さない。
CREATE TABLE api_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_api_tokens_user ON api_tokens(user_id);

-- 既存データの所有者。email は移行後に本人のアドレスへ更新する前提のプレースホルダ。
-- status='invited' のため、この行のままでは API を通れない（更新するまで fail closed）。
INSERT INTO users (id, google_sub, email, display_name, role, status, created_at, updated_at)
VALUES (
  'usr-owner',
  NULL,
  'owner@workout-habit.invalid',
  'Owner',
  'admin',
  'invited',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- ---------------------------------------------------------------------------
-- 3. 記録テーブルの再構築
-- ---------------------------------------------------------------------------

CREATE TABLE exercises (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_body_part_id TEXT NOT NULL REFERENCES body_parts(id) ON DELETE RESTRICT,
  default_rest_seconds INTEGER NOT NULL,
  default_bar_weight_kg REAL NOT NULL,
  category TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- カスタム種目の ID は newId('exercise') 由来で 'exercise-' 始まり、
-- プリセットは 'bench-press' 等の固定 slug。これで出所を判別できる。
INSERT INTO exercises (
  id, owner_user_id, name, primary_body_part_id, default_rest_seconds,
  default_bar_weight_kg, category, is_archived, created_at, updated_at
)
SELECT
  id,
  CASE WHEN id LIKE 'exercise-%' THEN 'usr-owner' ELSE NULL END,
  name,
  primary_body_part_id,
  default_rest_seconds,
  default_bar_weight_kg,
  category,
  is_archived,
  created_at,
  updated_at
FROM exercises_old;

CREATE INDEX idx_exercises_owner ON exercises(owner_user_id);

-- status に 'planned' を追加する（Step 5 で Claude Code が書く計画の下書き）。
-- source は計画の出所。人が作ったものと Claude Code が書いたものを区別する。
CREATE TABLE workouts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  performed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'completed')),
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'claude_code')),
  memo TEXT NOT NULL DEFAULT '',
  last_saved_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO workouts (
  id, user_id, performed_at, status, source, memo, last_saved_at, created_at, updated_at
)
SELECT id, 'usr-owner', performed_at, status, 'user', memo, last_saved_at, created_at, updated_at
FROM workouts_old;

CREATE INDEX idx_workouts_user_performed_at ON workouts(user_id, performed_at);
CREATE INDEX idx_workouts_user_status ON workouts(user_id, status);

CREATE TABLE workout_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL,
  rest_seconds_override INTEGER,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO workout_exercises (
  id, user_id, workout_id, exercise_id, order_index, rest_seconds_override, memo, created_at, updated_at
)
SELECT id, 'usr-owner', workout_id, exercise_id, order_index, rest_seconds_override, memo, created_at, updated_at
FROM workout_exercises_old;

CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workout_id);
CREATE INDEX idx_workout_exercises_exercise ON workout_exercises(exercise_id);
CREATE INDEX idx_workout_exercises_user ON workout_exercises(user_id);

CREATE TABLE workout_sets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
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

INSERT INTO workout_sets (
  id, user_id, workout_exercise_id, order_index, weight_kg, reps, rpe, is_warmup,
  is_completed, memo, rest_seconds, started_at, completed_at, deleted_at, created_at, updated_at
)
SELECT
  id, 'usr-owner', workout_exercise_id, order_index, weight_kg, reps, rpe, is_warmup,
  is_completed, memo, rest_seconds, started_at, completed_at, deleted_at, created_at, updated_at
FROM workout_sets_old;

CREATE INDEX idx_workout_sets_workout_exercise ON workout_sets(workout_exercise_id);
CREATE INDEX idx_workout_sets_user ON workout_sets(user_id);

CREATE TABLE timer_events (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_set_id TEXT NOT NULL REFERENCES workout_sets(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  duration_seconds INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT NOT NULL,
  sound_enabled INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 旧データには参照先を失った行が混じりうる（セット削除が物理削除のため）。
-- 外部キーを立てる前に、親が残っている行だけを移す。
INSERT INTO timer_events (
  id, user_id, workout_set_id, exercise_id, duration_seconds, started_at, ended_at,
  status, sound_enabled, created_at, updated_at
)
SELECT
  old.id, 'usr-owner', old.workout_set_id, old.exercise_id, old.duration_seconds,
  old.started_at, old.ended_at, old.status, old.sound_enabled, old.created_at, old.updated_at
FROM timer_events_old AS old
WHERE EXISTS (SELECT 1 FROM workout_sets WHERE workout_sets.id = old.workout_set_id)
  AND EXISTS (SELECT 1 FROM exercises WHERE exercises.id = old.exercise_id);

CREATE INDEX idx_timer_events_workout_set ON timer_events(workout_set_id);
CREATE INDEX idx_timer_events_user ON timer_events(user_id);

CREATE TABLE templates (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO templates (id, user_id, name, created_at, updated_at)
SELECT id, 'usr-owner', name, created_at, updated_at FROM templates_old;

CREATE INDEX idx_templates_user ON templates(user_id);

CREATE TABLE template_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO template_exercises (id, user_id, template_id, exercise_id, order_index, created_at, updated_at)
SELECT old.id, 'usr-owner', old.template_id, old.exercise_id, old.order_index, old.created_at, old.updated_at
FROM template_exercises_old AS old
WHERE EXISTS (SELECT 1 FROM templates WHERE templates.id = old.template_id)
  AND EXISTS (SELECT 1 FROM exercises WHERE exercises.id = old.exercise_id);

CREATE INDEX idx_template_exercises_template ON template_exercises(template_id);
CREATE INDEX idx_template_exercises_user ON template_exercises(user_id);

-- measured_at の UNIQUE を (user_id, measured_at) の複合ユニークへ張り替える。
-- 単独 UNIQUE のままだと、ユーザーをまたいで同じ測定日が衝突する。
CREATE TABLE body_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_at TEXT NOT NULL,
  body_weight_kg REAL NOT NULL,
  body_fat_percentage REAL,
  estimated_calories_burned REAL,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, measured_at)
);

INSERT INTO body_logs (
  id, user_id, measured_at, body_weight_kg, body_fat_percentage,
  estimated_calories_burned, memo, created_at, updated_at
)
SELECT
  id, 'usr-owner', measured_at, body_weight_kg, body_fat_percentage,
  estimated_calories_burned, memo, created_at, updated_at
FROM body_logs_old;

-- ---------------------------------------------------------------------------
-- 4. 旧テーブルの破棄
-- ---------------------------------------------------------------------------

DROP TABLE body_logs_old;
DROP TABLE template_exercises_old;
DROP TABLE templates_old;
DROP TABLE timer_events_old;
DROP TABLE workout_sets_old;
DROP TABLE workout_exercises_old;
DROP TABLE workouts_old;
DROP TABLE exercises_old;
