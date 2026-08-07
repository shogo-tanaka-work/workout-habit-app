-- Step 4: 操作ベース同期の冪等性を担保する台帳。
--
-- 端末（および Claude Code）は操作ごとに ID を振って送る。適用済みの ID を
-- ここへ記録しておき、再送されても2回適用しない。
-- 主キーを (user_id, id) の複合にしているのは、他人が同じ操作 ID を先に送って
-- 適用を妨げられないようにするため。

CREATE TABLE sync_operations (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  entity      TEXT NOT NULL,
  op          TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
  row_id      TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  applied_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE INDEX idx_sync_operations_applied_at ON sync_operations(user_id, applied_at);
