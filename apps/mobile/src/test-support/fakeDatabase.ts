import type * as SQLite from 'expo-sqlite';

// `db/queries.ts` を実 SQLite 無しで検証するための差し替え。
//
// expo-sqlite は端末のネイティブ実装で、Node 上のテストでは動かない。
// ここで見たいのは「どの条件でどの行を書き換えるか」という判断で、
// SQLite そのものの挙動ではないため、発行された SQL と引数を記録するだけの器を使う。
//
// 実 DB を使う検証（マイグレーション・制約）は実機の動線確認が受け持つ。

export type RunCall = { sql: string; params: unknown[] };

export type FakeDatabase = {
  /** `db/queries.ts` へ渡す偽の接続。 */
  database: SQLite.SQLiteDatabase;
  /** 実行された書き込みを実行順に持つ。 */
  runs: RunCall[];
  /** SQL に断片を含む書き込みだけを取り出す。 */
  runsMatching: (fragment: string) => RunCall[];
};

type Handlers = {
  getAll?: (sql: string, params: unknown[]) => Record<string, unknown>[];
  getFirst?: (sql: string, params: unknown[]) => Record<string, unknown> | null;
  /** UPDATE / INSERT が書き換えた行数。既定は 1（＝対象があった）。 */
  changes?: (sql: string, params: unknown[]) => number;
};

export const createFakeDatabase = (handlers: Handlers = {}): FakeDatabase => {
  const runs: RunCall[] = [];
  const database = {
    withTransactionAsync: (task: () => Promise<void>): Promise<void> => task(),
    runAsync: (sql: string, ...params: unknown[]) => {
      runs.push({ sql, params });
      return Promise.resolve({
        changes: handlers.changes?.(sql, params) ?? 1,
        lastInsertRowId: 0,
      });
    },
    getAllAsync: (sql: string, ...params: unknown[]) =>
      Promise.resolve(handlers.getAll?.(sql, params) ?? []),
    getFirstAsync: (sql: string, ...params: unknown[]) =>
      Promise.resolve(handlers.getFirst?.(sql, params) ?? null),
  };
  return {
    database: database as unknown as SQLite.SQLiteDatabase,
    runs,
    runsMatching: (fragment) => runs.filter((run) => run.sql.includes(fragment)),
  };
};
