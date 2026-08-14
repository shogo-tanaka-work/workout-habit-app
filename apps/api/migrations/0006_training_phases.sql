-- Step 10: トレーニングのフェーズ。
--
-- 現在の状態を1行で持たず、履歴として持つ。過去の減量期の成果を振り返れること、
-- 中断（引っ越し・怪我・多忙）の理由を期間へ紐付けられることが理由。
-- 期間としてブランクを記録できると、記録の少なさを「停滞」と誤読せずに済む。
--
-- 現在のフェーズ = ended_on IS NULL のうち started_on が最大の行。
-- 切り替えは「前のフェーズへ ended_on を入れてから新しい行を作る」の2操作で表す。
--
-- 主キーを id にしているのは、操作ベース同期（src/sync/apply.ts）が
-- ON CONFLICT(id) と WHERE id = ? で動いており、**id が全ユーザーで一意である前提**のため
-- （0004・0005 と同じ判断）。同じ開始日の書き直しは同じ id（phase-{userId}-{started_on}）を
-- 再利用して行い、別の id で書くと UNIQUE に当たって失敗する。
--
-- phase は取り得る値が閉じているため CHECK を付ける（users.role / workouts.status と同じ流儀）。

CREATE TABLE training_phases (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- cut=減量 / bulk=増量 / maintain=維持 / break=中断
  phase      TEXT NOT NULL CHECK (phase IN ('cut', 'bulk', 'maintain', 'break')),
  started_on TEXT NOT NULL,
  -- NULL なら進行中。
  ended_on   TEXT,
  -- そのフェーズの方針・制約（「断酒中」「回復優先」など）。
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, started_on)
);

CREATE INDEX idx_training_phases_user ON training_phases(user_id);
