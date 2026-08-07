// 送信待ちの操作キュー（outbox）。
//
// 記録操作はローカルへ即時反映しつつ、ここへ「何をしたか」を積む。
// 送信役（src/sync/pusher.ts）が契機ごとに取り出してサーバへ送る。
// オフラインでも積まれるだけで、画面は止まらない。

import type * as SQLite from 'expo-sqlite';

import { nowIso } from '../utils/datetime';
import { newId } from '../utils/id';
import type { SyncEntity } from './syncTables';
import { SYNC_COLUMNS } from './syncTables';

export type OutboxOperation = 'upsert' | 'delete';

export type OutboxEntry = {
  id: string;
  entity: SyncEntity;
  op: OutboxOperation;
  rowId: string;
  /** upsert のときの行スナップショット。delete では null。 */
  row: Record<string, unknown> | null;
  occurredAt: string;
  attempts: number;
};

type OutboxRow = {
  id: string;
  entity: string;
  op: string;
  row_id: string;
  payload: string | null;
  occurred_at: string;
  attempts: number;
};

/** 1回の送信で運ぶ操作の上限。サーバ側の上限（200）に合わせる。 */
export const MAX_OPERATIONS_PER_PUSH = 200;

const insertEntry = async (
  database: SQLite.SQLiteDatabase,
  entry: { entity: SyncEntity; op: OutboxOperation; rowId: string; payload: string | null },
): Promise<void> => {
  const timestamp = nowIso();
  await database.runAsync(
    `INSERT INTO sync_outbox (id, entity, op, row_id, payload, occurred_at, attempts, last_error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
    newId('op'),
    entry.entity,
    entry.op,
    entry.rowId,
    entry.payload,
    timestamp,
    timestamp,
  );
};

/**
 * 書き込んだ行のスナップショットを積む。
 * 行が見つからない場合は何もしない（直前に削除された等）。
 *
 * 同じ行の未送信 upsert が既にあれば、新たに積まず payload だけ最新へ差し替える。
 * 「記録のたびに last_saved_at を更新する」ような操作でキューが膨らむのを防ぐ。
 * **並び順（occurred_at）は据え置く。** 積み直すと親より子が先に送られ、
 * サーバ側で親が見つからず弾かれるため。
 */
export const enqueueUpsert = async (
  database: SQLite.SQLiteDatabase,
  entity: SyncEntity,
  rowId: string,
): Promise<void> => {
  const columns = SYNC_COLUMNS[entity];
  const row = await database.getFirstAsync<Record<string, unknown>>(
    `SELECT ${columns.join(', ')} FROM ${entity} WHERE id = ?`,
    rowId,
  );
  if (!row) {
    return;
  }
  const payload = JSON.stringify(row);
  const updated = await database.runAsync(
    "UPDATE sync_outbox SET payload = ? WHERE entity = ? AND row_id = ? AND op = 'upsert'",
    payload,
    entity,
    rowId,
  );
  if (updated.changes > 0) {
    return;
  }
  await insertEntry(database, { entity, op: 'upsert', rowId, payload });
};

/** 削除を積む。削除は明示的な操作として送るため、行が消えていても記録は残す。 */
export const enqueueDelete = (
  database: SQLite.SQLiteDatabase,
  entity: SyncEntity,
  rowId: string,
): Promise<void> => insertEntry(database, { entity, op: 'delete', rowId, payload: null });

const parsePayload = (payload: string | null, entryId: string): Record<string, unknown> | null => {
  if (payload === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(payload);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    console.warn(`[outbox] payload がオブジェクトではありません: ${entryId}`);
    return null;
  } catch (error) {
    console.warn(
      `[outbox] payload の復元に失敗: ${entryId}`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
};

/** 送信待ちの操作を古い順に取り出す。 */
export const listPendingOperations = async (
  database: SQLite.SQLiteDatabase,
  limit: number = MAX_OPERATIONS_PER_PUSH,
): Promise<OutboxEntry[]> => {
  const rows = await database.getAllAsync<OutboxRow>(
    `SELECT id, entity, op, row_id, payload, occurred_at, attempts
     FROM sync_outbox ORDER BY occurred_at, rowid LIMIT ?`,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    entity: row.entity as SyncEntity,
    op: row.op as OutboxOperation,
    rowId: row.row_id,
    row: parsePayload(row.payload, row.id),
    occurredAt: row.occurred_at,
    attempts: row.attempts,
  }));
};

export const countPendingOperations = async (
  database: SQLite.SQLiteDatabase,
): Promise<number> => {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sync_outbox',
  );
  return row?.count ?? 0;
};

/** 送信が確定した操作をキューから外す。 */
export const removeOperations = async (
  database: SQLite.SQLiteDatabase,
  operationIds: readonly string[],
): Promise<void> => {
  if (operationIds.length === 0) {
    return;
  }
  const placeholders = operationIds.map(() => '?').join(', ');
  await database.runAsync(
    `DELETE FROM sync_outbox WHERE id IN (${placeholders})`,
    ...operationIds,
  );
};

/** 失敗した操作に理由を残す。次回の送信でも再挑戦する。 */
export const recordFailure = async (
  database: SQLite.SQLiteDatabase,
  operationId: string,
  message: string,
): Promise<void> => {
  await database.runAsync(
    'UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?',
    message,
    operationId,
  );
};
