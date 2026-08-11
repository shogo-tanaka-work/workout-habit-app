-- Step 6 Phase 4: 共有プリセット種目に対する、ユーザーごとの上書き。
--
-- プリセット（exercises.owner_user_id IS NULL）は全ユーザー共有の行のため、
-- サーバは書き換えを受け付けない。レスト時間を変えても端末内にとどまっていた。
-- 上書きを別テーブルへ持たせて、共有の行を壊さずにユーザーごとの設定を成立させる。
--
-- 名前と部位は上書きの対象にしない。変えられると「共有プリセット」の意味が失われ、
-- 同じ ID が人によって別の種目を指すことになる。
--
-- 主キーを id にしているのは、操作ベース同期（src/sync/apply.ts）が
-- ON CONFLICT(id) と WHERE id = ? で動いており、**id が全ユーザーで一意である前提**のため。
-- (user_id, exercise_id) の複合主キーにすると汎用同期に乗らない。
-- id = exercise_id にする案も、別ユーザーの行と id が衝突して更新が黙って効かなくなる。
--
-- **既知の制約:** 複数端末で同じ種目の上書きを別々の id で作ると UNIQUE に当たり、
-- 片方の同期が失敗する。現状は1端末運用のため許容する。

CREATE TABLE user_exercise_settings (
  id            TEXT PRIMARY KEY NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id   TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  -- いずれも NULL は「上書きしない」。列を足すときも同じ規則にする。
  rest_seconds  INTEGER,
  bar_weight_kg REAL,
  is_archived   INTEGER,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (user_id, exercise_id)
);

CREATE INDEX idx_user_exercise_settings_user ON user_exercise_settings(user_id);
