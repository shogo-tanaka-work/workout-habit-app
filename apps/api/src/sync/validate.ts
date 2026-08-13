// 操作（intent）の形式検証。
//
// route から検証を分離し、この先には検証済みの型付き入力だけを渡す。
// 列の許可リストは tables.ts の定義を正とする。未知の列・未知のエンティティは通さない。

import type { SyncColumn, SyncTable } from '../tables';
import { findSyncTable } from '../tables';

/** 1リクエストで受け付ける操作の上限。 */
const MAX_OPERATIONS_PER_REQUEST = 200;

const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

export type SyncOperation = {
  id: string;
  /** 端末で操作が起きた時刻。後勝ちの判定に使う。 */
  occurredAt: string;
  table: SyncTable;
} & ({ op: 'upsert'; row: Record<string, unknown> } | { op: 'delete'; rowId: string });

export type ParsedOperation =
  | { ok: true; operation: SyncOperation }
  | { ok: false; id: string | null; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const valueMatchesType = (value: unknown, column: SyncColumn): boolean => {
  switch (column.type) {
    case 'text':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'real':
      return typeof value === 'number' && Number.isFinite(value);
  }
};

/** 行を列の許可リストで検証し、送られてきた列だけを取り出す。 */
const validateRow = (
  table: SyncTable,
  row: Record<string, unknown>,
): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } => {
  const allowedColumns = new Set(table.columns.map((column) => column.name));
  for (const key of Object.keys(row)) {
    if (!allowedColumns.has(key)) {
      return { ok: false, error: `unknown column: ${table.name}.${key}` };
    }
  }

  const validated: Record<string, unknown> = {};
  for (const column of table.columns) {
    const value = row[column.name];
    if (value === undefined) {
      if (column.optional) {
        continue;
      }
      return { ok: false, error: `missing column: ${table.name}.${column.name}` };
    }
    if (value === null) {
      if (!column.nullable) {
        return { ok: false, error: `column must not be null: ${table.name}.${column.name}` };
      }
      validated[column.name] = null;
      continue;
    }
    if (!valueMatchesType(value, column)) {
      return {
        ok: false,
        error: `column type mismatch: ${table.name}.${column.name} expects ${column.type}`,
      };
    }
    validated[column.name] = value;
  }

  if (!isNonEmptyString(validated.id)) {
    return { ok: false, error: `missing column: ${table.name}.id` };
  }
  return { ok: true, row: validated };
};

const parseOperation = (input: unknown): ParsedOperation => {
  if (!isRecord(input)) {
    return { ok: false, id: null, error: 'operation must be an object' };
  }
  const id = isNonEmptyString(input.id) ? input.id : null;
  if (!id) {
    return { ok: false, id: null, error: 'operation id is required' };
  }
  if (!isNonEmptyString(input.at) || !ISO_DATETIME_PATTERN.test(input.at)) {
    return { ok: false, id, error: 'at must be an ISO 8601 UTC datetime' };
  }
  if (!isNonEmptyString(input.entity)) {
    return { ok: false, id, error: 'entity is required' };
  }
  const table = findSyncTable(input.entity);
  if (!table) {
    return { ok: false, id, error: `unknown entity: ${input.entity}` };
  }

  if (input.op === 'delete') {
    if (!isNonEmptyString(input.rowId)) {
      return { ok: false, id, error: 'rowId is required for delete' };
    }
    return {
      ok: true,
      operation: { id, occurredAt: input.at, table, op: 'delete', rowId: input.rowId },
    };
  }

  if (input.op !== 'upsert') {
    return { ok: false, id, error: "op must be 'upsert' or 'delete'" };
  }
  if (!isRecord(input.row)) {
    return { ok: false, id, error: 'row is required for upsert' };
  }
  const validated = validateRow(table, input.row);
  if (!validated.ok) {
    return { ok: false, id, error: validated.error };
  }
  return {
    ok: true,
    operation: { id, occurredAt: input.at, table, op: 'upsert', row: validated.row },
  };
};

/** リクエスト body を操作の配列へ変換する。body 自体が不正なら error を返す。 */
export const parseOperations = (
  body: unknown,
): { ok: true; operations: ParsedOperation[] } | { ok: false; error: string } => {
  if (!isRecord(body) || !Array.isArray(body.operations)) {
    return { ok: false, error: 'operations must be an array' };
  }
  if (body.operations.length === 0) {
    return { ok: false, error: 'operations must not be empty' };
  }
  if (body.operations.length > MAX_OPERATIONS_PER_REQUEST) {
    return {
      ok: false,
      error: `operations must be ${MAX_OPERATIONS_PER_REQUEST} or fewer per request`,
    };
  }
  // 同一リクエスト内で操作 ID が重複していないか（冪等台帳の前に弾く）。
  const seenIds = new Set<string>();
  const operations = body.operations.map((item): ParsedOperation => {
    const parsed = parseOperation(item);
    if (!parsed.ok) {
      return parsed;
    }
    if (seenIds.has(parsed.operation.id)) {
      return { ok: false, id: parsed.operation.id, error: 'duplicated operation id in request' };
    }
    seenIds.add(parsed.operation.id);
    return parsed;
  });
  return { ok: true, operations };
};
