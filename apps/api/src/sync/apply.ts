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

type OperationStatus = 'applied' | 'duplicate' | 'stale' | 'rejected';

export type OperationResult = {
  id: string;
  status: OperationStatus;
  error?: string;
};

type OwnerRow = { owner: string | null; updated_at: string | null };

/**
 * 同一リクエスト内の行照会メモ。同じ行（親チェックで繰り返し引く workout 等）を
 * D1 へ何度も照会しないために持つ。リクエストを超えて保持しない。
 *
 * 逐次適用の順序依存を壊さないよう、upsert / delete を適用した時点で
 * エントリを適用後の状態へ更新する（updateCacheAfterApply）。
 */
type RowCache = {
  /** 同期対象テーブルの行。値 null は「行が無い」ことのメモ。キーは rowKeyOf。 */
  ownerRows: Map<string, OwnerRow | null>;
  /** 同期対象外の共有マスタ（body_parts 等）の存在確認。キーは rowKeyOf。 */
  sharedRowExists: Map<string, boolean>;
};

/** 適用処理がリクエスト内で持ち回る文脈。個別に渡すと引数が5つを超えるためまとめる。 */
type ApplyContext = {
  database: D1Database;
  user: AuthenticatedUser;
  rowCache: RowCache;
};

const rowKeyOf = (tableName: string, rowId: string): string => `${tableName}:${rowId}`;

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

const loadOwnerRow = async (
  context: ApplyContext,
  table: SyncTable,
  rowId: string,
): Promise<OwnerRow | null> => {
  const key = rowKeyOf(table.name, rowId);
  if (context.rowCache.ownerRows.has(key)) {
    return context.rowCache.ownerRows.get(key) ?? null;
  }
  const row = await context.database
    .prepare(
      `SELECT ${table.ownerColumn} AS owner, updated_at FROM ${table.name} WHERE id = ?`,
    )
    .bind(rowId)
    .first<OwnerRow>();
  context.rowCache.ownerRows.set(key, row);
  return row;
};

/**
 * 親行が使えるかを確かめる。
 * 同期対象外のテーブル（body_parts のような共有マスタ）は存在確認だけ行う。
 */
const parentIsUsable = async (
  context: ApplyContext,
  parentTableName: string,
  parentRowId: string,
): Promise<boolean> => {
  const parentTable = findSyncTable(parentTableName);
  if (!parentTable) {
    const key = rowKeyOf(parentTableName, parentRowId);
    const cachedExists = context.rowCache.sharedRowExists.get(key);
    if (cachedExists !== undefined) {
      return cachedExists;
    }
    const row = await context.database
      .prepare(`SELECT 1 AS found FROM ${parentTableName} WHERE id = ?`)
      .bind(parentRowId)
      .first<{ found: number }>();
    const exists = row !== null;
    context.rowCache.sharedRowExists.set(key, exists);
    return exists;
  }
  const row = await loadOwnerRow(context, parentTable, parentRowId);
  if (!row) {
    return false;
  }
  // owner が NULL の行は共有プリセット（種目マスタ）。誰でも参照できる。
  return row.owner === null || row.owner === context.user.id;
};

const buildUpsertStatement = (
  context: ApplyContext,
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
  const bindings = [...providedColumns.map((column) => row[column]), context.user.id];

  return context.database
    .prepare(
      `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${assignments}
       WHERE ${table.name}.${table.ownerColumn} = excluded.${table.ownerColumn}`,
    )
    .bind(...bindings);
};

const ledgerStatement = (
  context: ApplyContext,
  operation: SyncOperation,
  appliedAt: string,
): D1PreparedStatement =>
  context.database
    .prepare(
      `INSERT INTO sync_operations (user_id, id, entity, op, row_id, occurred_at, applied_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      context.user.id,
      operation.id,
      operation.table.name,
      operation.op,
      operation.op === 'delete' ? operation.rowId : String(operation.row.id),
      operation.occurredAt,
      appliedAt,
    );

/** 対象行が自分のものか。存在しない場合は null（新規作成とみなす）。 */
const checkExistingOwner = async (
  context: ApplyContext,
  table: SyncTable,
  rowId: string,
): Promise<{ ok: true; existing: OwnerRow | null } | { ok: false; error: string }> => {
  const existing = await loadOwnerRow(context, table, rowId);
  if (!existing) {
    return { ok: true, existing: null };
  }
  if (existing.owner !== context.user.id) {
    // 他人の行・共有プリセットは触らせない。存在を漏らさないため理由は not found で揃える。
    return { ok: false, error: 'row not found' };
  }
  return { ok: true, existing };
};

/**
 * 適用に成功した操作の結果をメモへ反映する。
 * 後続の操作（同じ行への再更新、この行を親に持つ子の追加）が古い状態を読まないため。
 */
const updateCacheAfterApply = (
  context: ApplyContext,
  operation: SyncOperation,
  existing: OwnerRow | null,
): void => {
  if (operation.op === 'delete') {
    context.rowCache.ownerRows.set(rowKeyOf(operation.table.name, operation.rowId), null);
    return;
  }
  const incomingUpdatedAt = operation.row.updated_at;
  context.rowCache.ownerRows.set(rowKeyOf(operation.table.name, String(operation.row.id)), {
    owner: context.user.id,
    // updated_at が行に無い upsert は既存値を保つ（UPDATE 句に updated_at が含まれないため）。
    updated_at:
      typeof incomingUpdatedAt === 'string' ? incomingUpdatedAt : (existing?.updated_at ?? null),
  });
};

const applyOne = async (
  context: ApplyContext,
  operation: SyncOperation,
  appliedAt: string,
): Promise<OperationResult> => {
  const table = operation.table;
  const rowId = operation.op === 'delete' ? operation.rowId : String(operation.row.id);

  const ownerCheck = await checkExistingOwner(context, table, rowId);
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
      if (!(await parentIsUsable(context, parent.table, parentRowId))) {
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
      await ledgerStatement(context, operation, appliedAt).run();
      return { id: operation.id, status: 'stale' };
    }
  }

  const mutation =
    operation.op === 'delete'
      ? context.database
          .prepare(`DELETE FROM ${table.name} WHERE id = ? AND ${table.ownerColumn} = ?`)
          .bind(rowId, context.user.id)
      : buildUpsertStatement(context, table, operation.row);

  try {
    // 適用と台帳への記録は 1 バッチ（= 1 トランザクション）にまとめる。
    await context.database.batch([mutation, ledgerStatement(context, operation, appliedAt)]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // 理由まで残す。クライアントが結果を捨てた場合、サーバ側だけが手がかりになる
    // （記録の中身は出さない。error-handling.md）。
    console.warn(`[sync] 操作の適用に失敗: ${table.name}/${operation.op}: ${message}`);
    return { id: operation.id, status: 'rejected', error: message };
  }

  updateCacheAfterApply(context, operation, ownerCheck.existing);
  return { id: operation.id, status: 'applied' };
};

/**
 * 操作を順に適用する。1件が失敗しても残りは適用し、結果を操作ごとに返す（部分成功）。
 * 端末は rejected だけを見て再送するか捨てるかを決める。
 * 逐次であるのは意図的（前の操作の適用結果を後の操作の親チェック・後勝ち判定が読む）。
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
  const context: ApplyContext = {
    database,
    user,
    rowCache: { ownerRows: new Map(), sharedRowExists: new Map() },
  };

  const results: OperationResult[] = [];
  for (const operation of operations) {
    if (alreadyApplied.has(operation.id)) {
      results.push({ id: operation.id, status: 'duplicate' });
      continue;
    }
    results.push(await applyOne(context, operation, appliedAt));
  }
  return { appliedAt, results };
};
