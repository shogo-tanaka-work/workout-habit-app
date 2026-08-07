import type * as SQLite from 'expo-sqlite';

import { SCHEMA_SQL } from './schema';

// SQLite のマイグレーション。`PRAGMA user_version` で適用済みバージョンを管理する。
//
// 追加のしかた:
//   1. MIGRATIONS の末尾へ version を1つ進めたエントリを足す
//   2. statements には ALTER TABLE / CREATE INDEX など「既存DBへ差分を当てる」SQL を書く
//   3. 新規インストールにも同じ差分が当たるよう、CREATE TABLE は schema.ts 側にも反映する
//
// version 1 は初期スキーマ。`CREATE TABLE IF NOT EXISTS` なので、
// user_version を持たない既存端末（この機構の導入前に作られたDB）へ当てても既存データを壊さない。

export type Migration = {
  /** 適用後の user_version。1 から始めて 1 ずつ増やす。 */
  version: number;
  /** 何をする移行かの1行説明。 */
  description: string;
  /** 順に実行する SQL。1文ずつに分けて書く。 */
  statements: readonly string[];
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: '初期スキーマ（全テーブル作成）',
    statements: [SCHEMA_SQL],
  },
  {
    version: 2,
    description: '送信待ちの操作を貯める sync_outbox を追加',
    statements: [
      `CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        entity TEXT NOT NULL,
        op TEXT NOT NULL,
        row_id TEXT NOT NULL,
        payload TEXT,
        occurred_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX IF NOT EXISTS idx_sync_outbox_occurred_at ON sync_outbox(occurred_at)',
    ],
  },
];

/** 適用済みの user_version。 */
const readUserVersion = async (database: SQLite.SQLiteDatabase): Promise<number> => {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
};

/**
 * 未適用のマイグレーションを version 昇順で適用する。
 * 1つのマイグレーションはトランザクションでまとめ、成功したら user_version を進める。
 */
export const runMigrations = async (database: SQLite.SQLiteDatabase): Promise<number> => {
  const currentVersion = await readUserVersion(database);
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    try {
      await database.withTransactionAsync(async () => {
        for (const statement of migration.statements) {
          await database.execAsync(statement);
        }
      });
      // PRAGMA はトランザクション内で設定しても反映されないため、成功後に別途実行する。
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    } catch (error) {
      throw new Error(
        `migration ${migration.version}（${migration.description}）の適用に失敗: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      );
    }
  }

  return pending.length > 0 ? pending[pending.length - 1].version : currentVersion;
};
