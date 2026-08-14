-- Step 11: フェーズに lean_bulk（リーンバルク）を足す。
--
-- 通常の増量（bulk）と分けるのは、**評価の期待値が違う**ため。
-- リーンバルクは緩やかなカロリー余剰で脂肪増を抑える進め方なので、体重・重量の伸びは
-- 通常のバルクより緩やかになる。同じ `bulk` に丸めると「伸びが鈍い＝停滞」と誤読する。
--
-- SQLite は CHECK 制約を ALTER TABLE で変更できないため、テーブルを作り直す
-- （新テーブル作成 → 複製 → 旧削除 → リネーム。rules/d1.md の段階適用の形）。
-- 0006 で作った直後の小さなテーブルなので、この時点で作り直すのが最も安い。

CREATE TABLE training_phases_new (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- cut=減量 / bulk=増量 / lean_bulk=リーンバルク / maintain=維持 / break=中断
  phase      TEXT NOT NULL CHECK (phase IN ('cut', 'bulk', 'lean_bulk', 'maintain', 'break')),
  started_on TEXT NOT NULL,
  ended_on   TEXT,
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, started_on)
);

INSERT INTO training_phases_new (id, user_id, phase, started_on, ended_on, note, created_at, updated_at)
SELECT id, user_id, phase, started_on, ended_on, note, created_at, updated_at FROM training_phases;

DROP TABLE training_phases;

ALTER TABLE training_phases_new RENAME TO training_phases;

CREATE INDEX idx_training_phases_user ON training_phases(user_id);
