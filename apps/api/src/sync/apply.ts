// 操作（intent）の適用。
//
// 端末は「ローカルへ即時反映 ＋ 操作をキューへ積む」で動き、送信役がここへ送ってくる。
// 同じ操作 ID を2回受けても壊れないこと（冪等）と、他人の行に触れないこと（スコープ）が要件。
//
// 競合は後勝ち。ただし「後」は端末の updated_at で判定するため、
// 手元の行が送られてきた行より新しければ適用しない（stale）。

import type { AuthenticatedUser } from '../auth/types';
import type { SyncTable } from '../tables';
import { columnNamesOf, findSyncTable } from '../tables';
import type { SyncOperation } from './validate';

/** D1 のバインド変数上限（100）を超えないための IN 句のチャンクサイズ。 */
const MAX_IN_CLAUSE_ITEMS = 90;

export type OperationStatus = 'applied' | 'duplicate' | 'stale' | 'rejected';

export type OperationResult = {
  id: string;
  status: OperationStatus;
  error?: string;
};

type OwnerRow = { owner: string | null; updated_at: string | null };

/** 適用済みの操作 ID を引く。再送された操作を2回適用しないための台帳。 */
const loadAppliedOperationIds = async (
  database: D1Database,
  userId: string,
  ids: readonly string[],
): Promise<Set<string>> => {
  const applied = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += MAX_IN_CLAUSE_ITEMS) {
    const chunk = ids.slice(offset, offset + MAX_IN_CLAUSE_ITEMS);
    const placeholders = chunk.map(() => '?').join(', ');
    const result = await database
      .prepare(
        `SELECT id FROM sync_operations WHERE user_id = ? AND id IN (${placeholders})`,
      )
      .bind(userId, ...chunk)
      .all<{ id: string }>();
    for (const row of result.results) {
      applied.add(row.id);
    }
  }
  return applied;
};

const loadOwnerRow = (
  database: D1Database,
  table: SyncTable,
  rowId: string,
): Promise<OwnerRow | null> =>
  database
    .prepare(
      `SELECT ${table.ownerColumn} AS owner, updated_at FROM ${table.name} WHERE id = ?`,
    )
    .bind(rowId)
    .first<OwnerRow>();

/**
 * 親行が使えるかを確かめる。
 * 同期対象外のテーブル（body_parts のような共有マスタ）は存在確認だけ行う。
 */
const parentIsUsable = async (
  database: D1Database,
  user: AuthenticatedUser,
  parentTableName: string,
  parentRowId: string,
): Promise<boolean> => {
  const parentTable = findSyncTable(parentTableName);
  if (!parentTable) {
    const row = await database
      .prepare(`SELECT 1 AS found FROM ${parentTableName} WHERE id = ?`)
      .bind(parentRowId)
      .first<{ found: number }>();
    return row !== null;
  }
  const row = await loadOwnerRow(database, parentTable, parentRowId);
  if (!row) {
    return false;
  }
  // owner が NULL の行は共有プリセット（種目マスタ）。誰でも参照できる。
  return row.owner === null || row.owner === user.id;
};

const buildUpsertStatement = (
  database: D1Database,
  user: AuthenticatedUser,
  table: SyncTable,
  row: Record<string, unknown>,
): D1PreparedStatement => {
  const providedColumns = columnNamesOf(table).filter((column) => column in row);
  const columns = [...providedColumns, table.ownerColumn];
  const placeholders = columns.map(() => '?').join(', ');
  // id は競合キーなので更新対象から外す。所有者列も更新しない（横取りを防ぐ）。
  const assignments = providedColumns
    .filter((column) => column !== 'id')
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
  const bindings = [...providedColumns.map((column) => row[column]), user.id];

  return database
    .prepare(
      `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${assignments}
       WHERE ${table.name}.${table.ownerColumn} = excluded.${table.ownerColumn}`,
    )
    .bind(...bindings);
};

const ledgerStatement = (
  database: D1Database,
  user: AuthenticatedUser,
  operation: SyncOperation,
  appliedAt: string,
): D1PreparedStatement =>
  database
    .prepare(
      `INSERT INTO sync_operations (user_id, id, entity, op, row_id, occurred_at, applied_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      user.id,
      operation.id,
      operation.table.name,
      operation.op,
      operation.op === 'delete' ? operation.rowId : String(operation.row.id),
      operation.occurredAt,
      appliedAt,
    );

/** 対象行が自分のものか。存在しない場合は null（新規作成とみなす）。 */
const checkExistingOwner = async (
  database: D1Database,
  user: AuthenticatedUser,
  table: SyncTable,
  rowId: string,
): Promise<{ ok: true; existing: OwnerRow | null } | { ok: false; error: string }> => {
  const existing = await loadOwnerRow(database, table, rowId);
  if (!existing) {
    return { ok: true, existing: null };
  }
  if (existing.owner !== user.id) {
    // 他人の行・共有プリセットは触らせない。存在を漏らさないため理由は not found で揃える。
    return { ok: false, error: 'row not found' };
  }
  return { ok: true, existing };
};

const applyOne = async (
  database: D1Database,
  user: AuthenticatedUser,
  operation: SyncOperation,
  appliedAt: string,
): Promise<OperationResult> => {
  const table = operation.table;
  const rowId = operation.op === 'delete' ? operation.rowId : String(operation.row.id);

  const ownerCheck = await checkExistingOwner(database, user, table, rowId);
  if (!ownerCheck.ok) {
    return { id: operation.id, status: 'rejected', error: ownerCheck.error };
  }

  if (operation.op === 'upsert') {
    for (const parent of table.parents ?? []) {
      const parentRowId = operation.row[parent.column];
      if (typeof parentRowId !== 'string') {
        return {
          id: operation.id,
          status: 'rejected',
          error: `missing column: ${table.name}.${parent.column}`,
        };
      }
      if (!(await parentIsUsable(database, user, parent.table, parentRowId))) {
        return {
          id: operation.id,
          status: 'rejected',
          error: `parent not found: ${parent.table}.${parentRowId}`,
        };
      }
    }

    // 後勝ち。手元の行のほうが新しければ適用しない（台帳には記録して再送を止める）。
    const incomingUpdatedAt = operation.row.updated_at;
    if (
      ownerCheck.existing?.updated_at &&
      typeof incomingUpdatedAt === 'string' &&
      ownerCheck.existing.updated_at > incomingUpdatedAt
    ) {
      await ledgerStatement(database, user, operation, appliedAt).run();
      return { id: operation.id, status: 'stale' };
    }
  }

  const mutation =
    operation.op === 'delete'
      ? database
          .prepare(`DELETE FROM ${table.name} WHERE id = ? AND ${table.ownerColumn} = ?`)
          .bind(rowId, user.id)
      : buildUpsertStatement(database, user, table, operation.row);

  try {
    // 適用と台帳への記録は 1 バッチ（= 1 トランザクション）にまとめる。
    await database.batch([mutation, ledgerStatement(database, user, operation, appliedAt)]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[sync] 操作の適用に失敗: ${table.name}/${operation.op}`);
    return { id: operation.id, status: 'rejected', error: message };
  }

  return { id: operation.id, status: 'applied' };
};

/**
 * 操作を順に適用する。1件が失敗しても残りは適用し、結果を操作ごとに返す（部分成功）。
 * 端末は rejected だけを見て再送するか捨てるかを決める。
 */
export const applyOperations = async (
  database: D1Database,
  user: AuthenticatedUser,
  operations: readonly SyncOperation[],
): Promise<{ appliedAt: string; results: OperationResult[] }> => {
  const appliedAt = new Date().toISOString();
  const alreadyApplied = await loadAppliedOperationIds(
    database,
    user.id,
    operations.map((operation) => operation.id),
  );

  const results: OperationResult[] = [];
  for (const operation of operations) {
    if (alreadyApplied.has(operation.id)) {
      results.push({ id: operation.id, status: 'duplicate' });
      continue;
    }
    results.push(await applyOne(database, user, operation, appliedAt));
  }
  return { appliedAt, results };
};
