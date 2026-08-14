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
//
// 「既存エントリを書き換えない」規則の例外について:
// version 1（= SCHEMA_SQL）にはかつて `PRAGMA journal_mode = WAL` が含まれていたが、削除した。
// この migration は withTransactionAsync の中で実行され、SQLite はトランザクション中の
// WAL 化をエラーにするため、新規インストールの初期化が失敗し得た。
// 適用済み端末（旧実装で WAL 化済み）には二度と実行されず、未適用端末にとっては
// 失敗要因の除去なので、既存エントリの書き換えだが正当と判断した。
// WAL 化は接続セットアップ（hooks/useWorkoutStore.ts）が担う。

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
  {
    version: 3,
    description: '平文で保存していた同期トークンを削除（認証は Google サインインへ移行）',
    statements: ["DELETE FROM app_settings WHERE key = 'sync_api_token'"],
  },
  {
    version: 4,
    description: '共有プリセット種目のユーザー別上書き（user_exercise_settings）を追加',
    statements: [
      `CREATE TABLE IF NOT EXISTS user_exercise_settings (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_id TEXT NOT NULL,
        rest_seconds INTEGER,
        bar_weight_kg REAL,
        is_archived INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (exercise_id)
      )`,
    ],
  },
  {
    version: 5,
    description: '読み取りと同期キューの検索を速くするインデックスを追加',
    statements: [
      `CREATE INDEX IF NOT EXISTS idx_workout_sets_workout_exercise_id
        ON workout_sets(workout_exercise_id)`,
      `CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id
        ON workout_exercises(workout_id)`,
      `CREATE INDEX IF NOT EXISTS idx_workouts_status_performed_at
        ON workouts(status, performed_at)`,
      `CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity_row_id
        ON sync_outbox(entity, row_id)`,
    ],
  },
  {
    version: 6,
    description: '週次フィードバック（weekly_feedback）と種目別目標（exercise_goals）を追加',
    statements: [
      // 端末は単一ユーザーのため user_id 列は持たない（user_exercise_settings と同じ流儀）。
      `CREATE TABLE IF NOT EXISTS weekly_feedback (
        id TEXT PRIMARY KEY NOT NULL,
        week_start TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (week_start)
      )`,
      `CREATE TABLE IF NOT EXISTS exercise_goals (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_id TEXT NOT NULL REFERENCES exercises(id),
        target_weight_kg REAL NOT NULL,
        memo TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (exercise_id)
      )`,
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
