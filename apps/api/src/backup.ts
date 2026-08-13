// 復元用の読み出し。
//
// **ロールに関わらず常に本人のデータだけを対象にする。** admin が全件を見るのは
// 分析 API の役割であり、全件を端末へ復元する経路は作らない。
//
// 書き込み（全置換の POST）は持たない。端末からサーバへの反映は操作ベースの
// `POST /sync/operations` が受け持つ（apps/mobile/src/sync/pusher.ts）。

import { Hono } from 'hono';

import type { AuthenticatedUser } from './auth/types';
import { scopeForExercise, scopeForUser } from './db/scope';
import type { AppEnv } from './env';
import type { BackupPayload, SyncTable } from './tables';
import { columnNamesOf, SYNC_TABLES } from './tables';

/**
 * 読み出しのスコープ。種目は共有プリセットも返さないと端末側で復元できないため、
 * NULL 所有（プリセット）を含める db/scope.ts の種目用スコープを使う。
 */
const selectScopeOf = (table: SyncTable, user: AuthenticatedUser) =>
  table.ownerColumn === 'owner_user_id'
    ? scopeForExercise(user, table.ownerColumn)
    : scopeForUser(user, table.ownerColumn);

export const backup = new Hono<AppEnv>();

backup.get('/', async (context) => {
  const user = context.get('user');
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of SYNC_TABLES) {
    const scope = selectScopeOf(table, user);
    const result = await context.env.DB.prepare(
      `SELECT ${columnNamesOf(table).join(', ')} FROM ${table.name} WHERE ${scope.condition}`,
    )
      .bind(...scope.params)
      .all();
    tables[table.name] = result.results;
  }
  return context.json({ exportedAt: new Date().toISOString(), tables } satisfies BackupPayload);
});
