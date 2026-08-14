-- Step 9: 週次 AI フィードバックと種目別の目標。
--
-- weekly_feedback は Claude Code が計画立案時に書く週単位のフィードバック。
-- アーカイブとして残す前提で、上書きは同一週（同じ行）に限る。
-- exercise_goals は種目ごとの目標重量。共有プリセット種目（owner_user_id IS NULL）にも
-- 目標を立てられるよう、user_exercise_settings と同じ「ユーザーごとの行を別テーブルで持つ」形にする。
--
-- 主キーを id にしているのは、操作ベース同期（src/sync/apply.ts）が
-- ON CONFLICT(id) と WHERE id = ? で動いており、**id が全ユーザーで一意である前提**のため
-- （0004 と同じ判断）。同一週・同一種目の上書きは同じ id を再利用して行い、
-- 別の id で書くと UNIQUE に当たって失敗する。

CREATE TABLE weekly_feedback (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 月曜はじまりの週開始日（YYYY-MM-DD）。utils/isoDate.ts の weekStartIso と同じ定義。
  week_start TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, week_start)
);

CREATE INDEX idx_weekly_feedback_user ON weekly_feedback(user_id);

CREATE TABLE exercise_goals (
  id               TEXT PRIMARY KEY NOT NULL,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id      TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  target_weight_kg REAL NOT NULL,
  memo             TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (user_id, exercise_id)
);

CREATE INDEX idx_exercise_goals_user ON exercise_goals(user_id);
