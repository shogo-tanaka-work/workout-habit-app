import type * as SQLite from 'expo-sqlite';

import type { SyncSettings, TimerSettings, TimerState } from '../types/domain';
import { DEFAULT_REST_PRESETS, REST_PRESET_LIMIT } from '../types/domain';
import type { AppSettingRow } from '../types/db';
import { nowIso } from '../utils/datetime';

// 端末ローカルの設定（app_settings テーブル）。key-value の1テーブルで持つ。
//
// **ここは同期対象外。** 送信キュー（outbox）へ積まない。
// 接続先・通知設定・共通タイマー・実行中の休憩タイマーはいずれも端末の都合であり、
// 他の端末やサーバへ持っていく意味がないため。
// 同期対象のテーブルを書くときは db/queries.ts 側を使う（enqueue が要る）。

// app_settings のキー。タイマー設定の値は '0' / '1' の文字列で持つ。
const TIMER_SOUND_KEY = 'timer_sound_enabled';

const TIMER_VIBRATION_KEY = 'timer_vibration_enabled';

const SYNC_API_URL_KEY = 'sync_api_url';

const SYNC_LAST_BACKUP_AT_KEY = 'sync_last_backup_at';

const SYNC_PAUSED_KEY = 'sync_paused';

const REST_TIMER_KEY = 'rest_timer';

const TIMER_REST_PRESETS_KEY = 'timer_rest_presets';

// 共通タイマーは JSON 配列（秒）で持つ。壊れた値・空配列は既定へ落とす。

// 共通タイマーは JSON 配列（秒）で持つ。壊れた値・空配列は既定へ落とす。
const toRestPresets = (raw: string | undefined): number[] => {
  if (!raw) {
    return DEFAULT_REST_PRESETS;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_REST_PRESETS;
    }
    const presets = parsed
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      .map((value) => Math.max(0, Math.round(value)))
      .slice(0, REST_PRESET_LIMIT);
    return presets.length > 0 ? presets : DEFAULT_REST_PRESETS;
  } catch {
    return DEFAULT_REST_PRESETS;
  }
};

export const toTimerSettings = (rows: AppSettingRow[]): TimerSettings => {
  const valueByKey = new Map(rows.map((row) => [row.key, row.value]));
  // 未設定（初回起動）はどちらも有効を既定とする。
  return {
    soundEnabled: valueByKey.get(TIMER_SOUND_KEY) !== '0',
    vibrationEnabled: valueByKey.get(TIMER_VIBRATION_KEY) !== '0',
    restPresets: toRestPresets(valueByKey.get(TIMER_REST_PRESETS_KEY)),
  };
};

export const toSyncSettings = (rows: AppSettingRow[]): SyncSettings => {
  const valueByKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    apiUrl: valueByKey.get(SYNC_API_URL_KEY) ?? '',
    lastBackupAt: valueByKey.get(SYNC_LAST_BACKUP_AT_KEY) ?? null,
    // 未設定は「停止していない」。自動送信が既定。
    isPaused: valueByKey.get(SYNC_PAUSED_KEY) === '1',
  };
};

// すべてのテーブルを読み込みドメイン型へ変換して返す。
// カラムは types/db.ts の行型と対応させて明示する（SELECT * を使わない）。

// app_settings へ1件保存する（既存キーは上書き）。
const upsertAppSetting = async (
  database: SQLite.SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> => {
  await database.runAsync(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    nowIso(),
  );
};

// サーバの接続先を保存する。認証情報はここに置かない。

// サーバの接続先を保存する。認証情報はここに置かない。
export const upsertSyncConnection = async (
  database: SQLite.SQLiteDatabase,
  params: { apiUrl: string },
): Promise<void> => {
  await upsertAppSetting(database, SYNC_API_URL_KEY, params.apiUrl);
};

// 自動送信の一時停止を保存する。端末ローカル設定のため同期対象外。

// 自動送信の一時停止を保存する。端末ローカル設定のため同期対象外。
export const setSyncPaused = async (
  database: SQLite.SQLiteDatabase,
  isPaused: boolean,
): Promise<void> => {
  await upsertAppSetting(database, SYNC_PAUSED_KEY, isPaused ? '1' : '0');
};

/**
 * 実行中の休憩タイマーを保存する。端末ローカル設定のため同期対象外。
 * null を渡すと消す（タイマーを閉じたとき）。
 *
 * 保存するのは終了時刻（endsAt）を含む状態そのもの。残り秒だけを持つと、
 * アプリが落ちている間の経過を復元できない。
 */

/**
 * 実行中の休憩タイマーを保存する。端末ローカル設定のため同期対象外。
 * null を渡すと消す（タイマーを閉じたとき）。
 *
 * 保存するのは終了時刻（endsAt）を含む状態そのもの。残り秒だけを持つと、
 * アプリが落ちている間の経過を復元できない。
 */
export const saveRestTimer = async (
  database: SQLite.SQLiteDatabase,
  timer: TimerState | null,
): Promise<void> => {
  if (!timer) {
    await database.runAsync('DELETE FROM app_settings WHERE key = ?', REST_TIMER_KEY);
    return;
  }
  await upsertAppSetting(database, REST_TIMER_KEY, JSON.stringify(timer));
};

/** 保存された休憩タイマーを読む。壊れていたら無視する（タイマーは復元できなくても致命的ではない）。 */

/** 保存された休憩タイマーを読む。壊れていたら無視する（タイマーは復元できなくても致命的ではない）。 */
export const loadRestTimer = async (
  database: SQLite.SQLiteDatabase,
): Promise<TimerState | null> => {
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    REST_TIMER_KEY,
  );
  if (!row) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(row.value);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as TimerState;
  } catch (error) {
    console.warn(
      '[timer] 保存された休憩タイマーを読めませんでした',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
};

// 最終バックアップ日時を記録する。

// 最終バックアップ日時を記録する。
export const markLastBackupAt = async (
  database: SQLite.SQLiteDatabase,
  timestamp: string,
): Promise<void> => {
  await upsertAppSetting(database, SYNC_LAST_BACKUP_AT_KEY, timestamp);
};

// ボディログを保存する。同じ計測日があれば上書き（1日1件）。

// タイマー設定（音・振動・共通タイマー）を app_settings に保存する。
export const upsertTimerSettings = async (
  database: SQLite.SQLiteDatabase,
  settings: TimerSettings,
): Promise<void> => {
  const timestamp = nowIso();
  const entries: [string, boolean][] = [
    [TIMER_SOUND_KEY, settings.soundEnabled],
    [TIMER_VIBRATION_KEY, settings.vibrationEnabled],
  ];
  for (const [key, enabled] of entries) {
    await database.runAsync(
      `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      enabled ? '1' : '0',
      timestamp,
    );
  }
  await upsertAppSetting(
    database,
    TIMER_REST_PRESETS_KEY,
    JSON.stringify(settings.restPresets.slice(0, REST_PRESET_LIMIT)),
  );
};

// ワークアウトの最終保存時刻を更新する（記録の都度保存）。
