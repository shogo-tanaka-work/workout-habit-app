import type * as SQLite from 'expo-sqlite';

import type { SyncEntity } from './syncTables';
import { SYNC_COLUMNS } from './syncTables';

// サーバ（apps/api）からの取り込み。
//
// 送信は操作キュー（src/db/outbox.ts と src/sync/pusher.ts）が担う。
// このファイルが受け持つのは「D1 の内容で端末を作り直す」向きだけで、
// 機種変更・再インストール・端末データ破損からの復帰に使う。
//
// body_parts は全ユーザー共有のマスタで seed が投入するため、取り込み対象に含めない。
// app_settings と sync_outbox は端末ローカルのため対象外。

export type BackupPayload = {
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};

const RESTORE_ORDER: readonly SyncEntity[] = [
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'timer_events',
  'templates',
  'template_exercises',
  'body_logs',
];

// SQLite のバインド値へ安全に変換する（JSON経由の unknown を絞り込む）。
const toSqlValue = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
};

/**
 * サーバから取得した内容で端末のデータを作り直す。
 * **送信待ちの操作は破棄する。** サーバの内容を正とする操作なので、
 * 古い端末側の操作を後から流し込むと取り込んだ内容を壊す。
 */
export const applyBackupPayload = async (
  database: SQLite.SQLiteDatabase,
  payload: BackupPayload,
): Promise<void> => {
  try {
    await database.withTransactionAsync(async () => {
      // 子から消す（外部キーの順序）。
      for (const entity of [...RESTORE_ORDER].reverse()) {
        await database.runAsync(`DELETE FROM ${entity}`);
      }
      for (const entity of RESTORE_ORDER) {
        const columns = SYNC_COLUMNS[entity];
        const rows = payload.tables[entity] ?? [];
        const placeholders = columns.map(() => '?').join(', ');
        for (const row of rows) {
          await database.runAsync(
            `INSERT INTO ${entity} (${columns.join(', ')}) VALUES (${placeholders})`,
            ...columns.map((column) => toSqlValue(row[column])),
          );
        }
      }
      await database.runAsync('DELETE FROM sync_outbox');
    });
  } catch (error) {
    throw new Error(
      `applyBackupPayload failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

const normalizeBaseUrl = (apiUrl: string): string => apiUrl.trim().replace(/\/+$/, '');

// サーバに保存されている自分のデータを取得する。
export const fetchBackupFromCloud = async (
  apiUrl: string,
  apiToken: string,
): Promise<BackupPayload> => {
  const response = await fetch(`${normalizeBaseUrl(apiUrl)}/backup`, {
    headers: { Authorization: `Bearer ${apiToken.trim()}` },
  });
  if (!response.ok) {
    throw new Error(`データの取得に失敗しました (HTTP ${response.status})`);
  }
  const payload = (await response.json()) as BackupPayload;
  if (typeof payload?.tables !== 'object' || payload.tables === null) {
    throw new Error('取得したデータの形式が不正です');
  }
  return payload;
};
