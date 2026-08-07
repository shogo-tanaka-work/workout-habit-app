// バックアップ / 復元。
//
// Step 4 の同期方式移行（D1 を唯一の正データにする）までの経路。
// **ロールに関わらず常に本人のデータだけを対象にする。** admin が全件を見るのは
// 分析 API の役割であり、全件を端末へ復元したり全件を置き換えたりする経路は作らない。

import { Hono } from 'hono';

import type { AppEnv } from './env';
import type { BackupPayload, SyncTable } from './tables';
import { SYNC_TABLES } from './tables';

// D1 の 1 クエリあたりのバインド変数上限（100）を超えないための行チャンクサイズ算出。
const MAX_BOUND_PARAMS = 90;
// 1 回の batch に積むステートメント数の上限（過大なバッチを避ける保守的な値）。
const MAX_STATEMENTS_PER_BATCH = 80;

/**
 * 読み出しのスコープ。種目は共有プリセットも返さないと端末側で復元できないため、
 * NULL 所有（プリセット）を含める。
 */
const selectScopeOf = (table: SyncTable): string =>
  table.ownerColumn === 'owner_user_id'
    ? `${table.ownerColumn} IS NULL OR ${table.ownerColumn} = ?`
    : `${table.ownerColumn} = ?`;

export const backup = new Hono<AppEnv>();

backup.get('/', async (context) => {
  const user = context.get('user');
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of SYNC_TABLES) {
    const result = await context.env.DB.prepare(
      `SELECT ${table.columns.join(', ')} FROM ${table.name} WHERE ${selectScopeOf(table)}`,
    )
      .bind(user.id)
      .all();
    tables[table.name] = result.results as Record<string, unknown>[];
  }
  return context.json({ exportedAt: new Date().toISOString(), tables } satisfies BackupPayload);
});

backup.post('/', async (context) => {
  const user = context.get('user');
  let payload: BackupPayload;
  try {
    payload = await context.req.json<BackupPayload>();
  } catch (error) {
    return context.json(
      { error: `invalid json: ${error instanceof Error ? error.message : String(error)}` },
      400,
    );
  }
  if (typeof payload?.tables !== 'object' || payload.tables === null) {
    return context.json({ error: 'tables is required' }, 400);
  }

  // 本人の行だけを DELETE → INSERT で置き換える。所有者の列はクライアントの値を使わず、
  // 認証済みユーザーの ID をサーバ側で埋める。
  // 削除は子テーブルから、挿入は親テーブルから行う（外部キー制約の順序）。
  const deleteStatements: D1PreparedStatement[] = [];
  const insertStatements: D1PreparedStatement[] = [];
  const counts: Record<string, number> = {};

  for (const table of [...SYNC_TABLES].reverse()) {
    deleteStatements.push(
      context.env.DB.prepare(`DELETE FROM ${table.name} WHERE ${table.ownerColumn} = ?`).bind(
        user.id,
      ),
    );
  }

  for (const table of SYNC_TABLES) {
    const rows = payload.tables[table.name] ?? [];
    counts[table.name] = rows.length;

    const columns = [...table.columns, table.ownerColumn];
    const rowsPerStatement = Math.max(1, Math.floor(MAX_BOUND_PARAMS / columns.length));
    for (let offset = 0; offset < rows.length; offset += rowsPerStatement) {
      const chunk = rows.slice(offset, offset + rowsPerStatement);
      const valuesClause = chunk.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
      const bindings = chunk.flatMap((row) => [
        ...table.columns.map((column) => row[column] ?? null),
        user.id,
      ]);
      insertStatements.push(
        context.env.DB.prepare(
          `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES ${valuesClause}`,
        ).bind(...bindings),
      );
    }
  }

  const statements = [...deleteStatements, ...insertStatements];
  try {
    for (let offset = 0; offset < statements.length; offset += MAX_STATEMENTS_PER_BATCH) {
      await context.env.DB.batch(statements.slice(offset, offset + MAX_STATEMENTS_PER_BATCH));
    }
  } catch (error) {
    return context.json(
      { error: `backup failed: ${error instanceof Error ? error.message : String(error)}` },
      500,
    );
  }

  return context.json({ ok: true, savedAt: new Date().toISOString(), counts });
});
