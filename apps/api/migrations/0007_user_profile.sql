-- Step 11: 基本情報（user_profile）。
--
-- 0006 のフェーズが「期間として持つ状態」だったのに対し、こちらは**恒常的に持つ属性**を置く。
-- トレーニングの目的（training_goal）は実績の読み方そのものを変えるため、
-- 計画立案の前提として1か所に持つ。
--
-- 1ユーザー1行。UNIQUE は user_id 単独（0006 の UNIQUE(user_id, started_on) と違い、
-- 期間ごとに増えることがない）。
--
-- 主キーを id にしているのは、操作ベース同期（src/sync/apply.ts）が
-- ON CONFLICT(id) と WHERE id = ? で動いており、**id が全ユーザーで一意である前提**のため
-- （0004・0005・0006 と同じ判断）。書き直しは同じ id（profile-{userId}）を再利用して行い、
-- 別の id で書くと UNIQUE(user_id) に当たって失敗する。
--
-- training_goal は取り得る値が閉じているため CHECK を付ける（users.role / training_phases.phase と同じ流儀）。
--
-- height_cm を任意（NULL 可）にしたのは、筋力の体格補正に身長が要らないため。
-- Wilks / DOTS / IPF GL はいずれも体重のみを入力とし、体重比（1RM ÷ 体重）でも足りる。
-- 身長が効くのは FFMI（除脂肪体重 ÷ 身長²）を一般基準と比べるときだけで、
-- 同一人物の時系列では定数のため推移の形は変わらない。

CREATE TABLE user_profile (
  id            TEXT PRIMARY KEY NOT NULL,
  user_id       TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- strength=筋力向上 / hypertrophy=筋肥大 / endurance=持久力 / general=総合
  training_goal TEXT NOT NULL CHECK (training_goal IN ('strength', 'hypertrophy', 'endurance', 'general')),
  -- NULL 可。任意入力（FFMI を一般基準と比べるときだけ必要）。
  height_cm     REAL,
  -- 目的の補足や恒常的な制約（「腰に持病あり」「週3が上限」など）。
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
