import type * as SQLite from 'expo-sqlite';

import { nowIso } from '../utils/datetime';

// クラウドバックアップ/復元（apps/api との連携）。
// テーブル・カラム定義は apps/api/src/tables.ts と同じものを持つ
// （モノレポ方針によりアプリ間の重複は許容）。
// app_settings は端末ローカル設定（タイマー設定・同期トークン）のため対象外。

export type SyncTable = {
  name: string;
  columns: readonly string[];
};

export const SYNC_TABLES: readonly SyncTable[] = [
  { name: 'body_parts', columns: ['id', 'name', 'order_index', 'created_at', 'updated_at'] },
  {
    name: 'exercises',
    columns: [
      'id',
      'name',
      'primary_body_part_id',
      'default_rest_seconds',
      'default_bar_weight_kg',
      'category',
      'is_archived',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'workouts',
    columns: ['id', 'performed_at', 'status', 'memo', 'last_saved_at', 'created_at', 'updated_at'],
  },
  {
    name: 'workout_exercises',
    columns: [
      'id',
      'workout_id',
      'exercise_id',
      'order_index',
      'rest_seconds_override',
      'memo',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'workout_sets',
    columns: [
      'id',
      'workout_exercise_id',
      'order_index',
      'weight_kg',
      'reps',
      'rpe',
      'is_warmup',
      'is_completed',
      'memo',
      'rest_seconds',
      'started_at',
      'completed_at',
      'deleted_at',
      'created_at',
      'updated_at',
    ],
  },
  {
    name: 'timer_events',
    columns: [
      'id',
      'workout_set_id',
      'exercise_id',
      'duration_seconds',
      'started_at',
      'ended_at',
      'status',
      'sound_enabled',
      'created_at',
      'updated_at',
    ],
  },
  { name: 'templates', columns: ['id', 'name', 'created_at', 'updated_at'] },
  {
    name: 'template_exercises',
    columns: ['id', 'template_id', 'exercise_id', 'order_index', 'created_at', 'updated_at'],
  },
  {
    name: 'body_logs',
    columns: [
      'id',
      'measured_at',
      'body_weight_kg',
      'body_fat_percentage',
      'estimated_calories_burned',
      'memo',
      'created_at',
      'updated_at',
    ],
  },
];

export type BackupPayload = {
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
};

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

// ローカルDBの同期対象テーブルをすべて読み出してバックアップペイロードを作る。
export const exportBackupPayload = async (
  database: SQLite.SQLiteDatabase,
): Promise<BackupPayload> => {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of SYNC_TABLES) {
    tables[table.name] = await database.getAllAsync<Record<string, unknown>>(
      `SELECT ${table.columns.join(', ')} FROM ${table.name}`,
    );
  }
  return { exportedAt: nowIso(), tables };
};

// バックアップペイロードでローカルDBを置き換える（復元）。全テーブルを1トランザクションで処理する。
export const applyBackupPayload = async (
  database: SQLite.SQLiteDatabase,
  payload: BackupPayload,
): Promise<void> => {
  try {
    await database.withTransactionAsync(async () => {
      for (const table of SYNC_TABLES) {
        await database.runAsync(`DELETE FROM ${table.name}`);
        const rows = payload.tables[table.name] ?? [];
        const placeholders = table.columns.map(() => '?').join(', ');
        for (const row of rows) {
          await database.runAsync(
            `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES (${placeholders})`,
            ...table.columns.map((column) => toSqlValue(row[column])),
          );
        }
      }
    });
  } catch (error) {
    throw new Error(
      `applyBackupPayload failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

const normalizeBaseUrl = (apiUrl: string): string => apiUrl.trim().replace(/\/+$/, '');

const authHeaders = (apiToken: string): Record<string, string> => ({
  Authorization: `Bearer ${apiToken.trim()}`,
});

// ローカルの全データをクラウドへ送る（クラウド側は全置き換え）。
export const pushBackupToCloud = async (
  apiUrl: string,
  apiToken: string,
  payload: BackupPayload,
): Promise<void> => {
  const response = await fetch(`${normalizeBaseUrl(apiUrl)}/backup`, {
    method: 'POST',
    headers: { ...authHeaders(apiToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`バックアップAPIがエラーを返しました (HTTP ${response.status})`);
  }
};

// クラウドのバックアップを取得する。
export const fetchBackupFromCloud = async (
  apiUrl: string,
  apiToken: string,
): Promise<BackupPayload> => {
  const response = await fetch(`${normalizeBaseUrl(apiUrl)}/backup`, {
    headers: authHeaders(apiToken),
  });
  if (!response.ok) {
    throw new Error(`バックアップの取得に失敗しました (HTTP ${response.status})`);
  }
  const payload = (await response.json()) as BackupPayload;
  if (typeof payload?.tables !== 'object' || payload.tables === null) {
    throw new Error('バックアップデータの形式が不正です');
  }
  return payload;
};
