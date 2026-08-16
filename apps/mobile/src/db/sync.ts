import type * as SQLite from 'expo-sqlite';

import { isRecord } from '../utils/isRecord';

import type { SyncEntity } from './syncTables';
import { SYNC_COLUMNS } from './syncTables';
import { runSerialized } from './writeQueue';

// サーバ（apps/api）からの取り込み。
//
// 送信は操作キュー（src/db/outbox.ts と src/sync/pusher.ts）が担う。
// このファイルが受け持つのは「D1 の内容で端末を作り直す」向きだけで、
// 機種変更・再インストール・端末データ破損からの復帰に使う。
//
// body_parts は全ユーザー共有のマスタで seed が投入するため、取り込み対象に含めない。
// app_settings と sync_outbox は端末ローカルのため対象外。

type BackupPayload = {
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};

const RESTORE_ORDER: readonly SyncEntity[] = [
  'exercises',
  'workouts',
  'workout_exercises',
  'workout_sets',
  'user_exercise_settings',
  'timer_events',
  'templates',
  'template_exercises',
  'body_logs',
  'weekly_feedback',
  // exercise_goals は exercises を親に持つため、exercises より後に復元する。
  'exercise_goals',
  'training_phases',
  'user_profile',
];

// SQLite のバインド値へ安全に変換する（JSON経由の unknown を絞り込む）。
const toSqlValue = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    // SQLite に真偽値の型は無い。API も 0/1 で返すが、念のため同じ形へ寄せる。
    return value ? 1 : 0;
  }
  if (value === null || value === undefined) {
    return null;
  }
  // 同期対象の列は text / integer / real だけ（apps/api/src/tables.ts）。
  // オブジェクトや配列が来るのは形式違反で、String() で押し込むと
  // '[object Object]' が記録として残る。取り込み全体を失敗させて気づけるようにする。
  throw new Error(`同期できない値の型です: ${typeof value}`);
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
  // 復元も記録の書き込みと同じキューに載せる（理由は db/writeQueue.ts）。
  const restoreAll = async () => {
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
  };

  try {
    await runSerialized(database, () => database.withTransactionAsync(restoreAll));
  } catch (error) {
    throw new Error(
      `applyBackupPayload failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

const normalizeBaseUrl = (apiUrl: string): string => apiUrl.trim().replace(/\/+$/, '');

// 復元はローカルを全消ししてから流し込むため、形を確かめてから通す
// （壊れた応答を as で名乗らせると「消してから気づく」ことになる）。
const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (!isRecord(value) || typeof value.exportedAt !== 'string' || !isRecord(value.tables)) {
    return false;
  }
  return Object.values(value.tables).every((rows) => Array.isArray(rows));
};

// サーバに保存されている自分のデータを取得する。
export const fetchBackupFromCloud = async (
  apiUrl: string,
  idToken: string,
): Promise<BackupPayload> => {
  const response = await fetch(`${normalizeBaseUrl(apiUrl)}/backup`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    throw new Error(`データの取得に失敗しました (HTTP ${response.status})`);
  }
  const payload: unknown = await response.json();
  if (!isBackupPayload(payload)) {
    throw new Error('取得したデータの形式が不正です');
  }
  return payload;
};
