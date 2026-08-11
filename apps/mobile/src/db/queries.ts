import type * as SQLite from 'expo-sqlite';

import type {
  BodyLog,
  BodyPart,
  Exercise,
  SyncSettings,
  Template,
  TemplateExercise,
  TimerSettings,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import type {
  AppSettingRow,
  BodyLogRow,
  BodyPartRow,
  ExerciseRow,
  TemplateExerciseRow,
  TemplateRow,
  WorkoutRow,
  WorkoutExerciseRow,
  WorkoutSetRow,
} from '../types/db';
import { nowIso } from '../utils/datetime';
import {
  toBodyLog,
  toBodyPart,
  toExercise,
  toTemplate,
  toTemplateExercise,
  toWorkout,
  toWorkoutExercise,
  toWorkoutSet,
} from './mappers';
import { enqueueDelete, enqueueUpsert } from './outbox';
import { isCustomExerciseId } from './syncTables';

// 書き込みは「ローカルへ即時反映 ＋ 送信キューへ積む」を1トランザクションで行う。
// 画面はローカルの結果だけを見て進み、送信は src/sync/pusher.ts が契機ごとに引き受ける。
// この関数を通さない書き込みを増やさないこと（キューに乗らず、端末にしか残らなくなる）。
const writeWithOutbox = async (
  database: SQLite.SQLiteDatabase,
  operationName: string,
  write: () => Promise<void>,
): Promise<void> => {
  try {
    await database.withTransactionAsync(write);
  } catch (error) {
    throw new Error(
      `${operationName} failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

export type WorkoutData = {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
  templates: Template[];
  templateExercises: TemplateExercise[];
  timerSettings: TimerSettings;
  bodyLogs: BodyLog[];
  syncSettings: SyncSettings;
};

// 取得カラム。types/db.ts の行型と1対1で対応させる。
// SELECT * を使うと、テーブルへ列を足したときに行型と静かにずれる。
const BODY_PART_COLUMNS = 'id, name, order_index';
const EXERCISE_COLUMNS =
  'id, name, primary_body_part_id, default_rest_seconds, default_bar_weight_kg, category, is_archived';
const WORKOUT_COLUMNS = 'id, performed_at, status, memo, last_saved_at, created_at';
const WORKOUT_EXERCISE_COLUMNS =
  'id, workout_id, exercise_id, order_index, rest_seconds_override, memo';
const WORKOUT_SET_COLUMNS =
  'id, workout_exercise_id, order_index, weight_kg, reps, rpe, is_warmup, is_completed, memo, rest_seconds, deleted_at';
const TEMPLATE_COLUMNS = 'id, name, created_at';
const TEMPLATE_EXERCISE_COLUMNS = 'id, template_id, exercise_id, order_index';

// app_settings のキー。タイマー設定の値は '0' / '1' の文字列で持つ。
const TIMER_SOUND_KEY = 'timer_sound_enabled';
const TIMER_VIBRATION_KEY = 'timer_vibration_enabled';
const SYNC_API_URL_KEY = 'sync_api_url';
const SYNC_LAST_BACKUP_AT_KEY = 'sync_last_backup_at';
const SYNC_PAUSED_KEY = 'sync_paused';

const toTimerSettings = (rows: AppSettingRow[]): TimerSettings => {
  const valueByKey = new Map(rows.map((row) => [row.key, row.value]));
  // 未設定（初回起動）はどちらも有効を既定とする。
  return {
    soundEnabled: valueByKey.get(TIMER_SOUND_KEY) !== '0',
    vibrationEnabled: valueByKey.get(TIMER_VIBRATION_KEY) !== '0',
  };
};

const toSyncSettings = (rows: AppSettingRow[]): SyncSettings => {
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
export const loadWorkoutData = async (database: SQLite.SQLiteDatabase): Promise<WorkoutData> => {
  const [
    bodyPartRows,
    exerciseRows,
    workoutRows,
    workoutExerciseRows,
    workoutSetRows,
    templateRows,
    templateExerciseRows,
    appSettingRows,
    bodyLogRows,
  ] = await Promise.all([
    database.getAllAsync<BodyPartRow>(
      `SELECT ${BODY_PART_COLUMNS} FROM body_parts ORDER BY order_index`,
    ),
    database.getAllAsync<ExerciseRow>(
      // アーカイブ済みも読み込む。除外すると戻す手段が無くなるうえ、
      // 過去の記録から種目名を引けなくなる。表示側で絞る。
      `SELECT ${EXERCISE_COLUMNS} FROM exercises ORDER BY name`,
    ),
    database.getAllAsync<WorkoutRow>(
      `SELECT ${WORKOUT_COLUMNS} FROM workouts ORDER BY created_at DESC`,
    ),
    database.getAllAsync<WorkoutExerciseRow>(
      `SELECT ${WORKOUT_EXERCISE_COLUMNS} FROM workout_exercises ORDER BY order_index`,
    ),
    database.getAllAsync<WorkoutSetRow>(
      `SELECT ${WORKOUT_SET_COLUMNS} FROM workout_sets ORDER BY order_index`,
    ),
    database.getAllAsync<TemplateRow>(
      `SELECT ${TEMPLATE_COLUMNS} FROM templates ORDER BY created_at DESC`,
    ),
    database.getAllAsync<TemplateExerciseRow>(
      `SELECT ${TEMPLATE_EXERCISE_COLUMNS} FROM template_exercises ORDER BY order_index`,
    ),
    database.getAllAsync<AppSettingRow>('SELECT key, value FROM app_settings'),
    database.getAllAsync<BodyLogRow>(
      'SELECT id, measured_at, body_weight_kg, body_fat_percentage, memo FROM body_logs ORDER BY measured_at DESC',
    ),
  ]);
  return {
    bodyParts: bodyPartRows.map(toBodyPart),
    exercises: exerciseRows.map(toExercise),
    workouts: workoutRows.map(toWorkout),
    workoutExercises: workoutExerciseRows.map(toWorkoutExercise),
    workoutSets: workoutSetRows.map(toWorkoutSet),
    templates: templateRows.map(toTemplate),
    templateExercises: templateExerciseRows.map(toTemplateExercise),
    timerSettings: toTimerSettings(appSettingRows),
    bodyLogs: bodyLogRows.map(toBodyLog),
    syncSettings: toSyncSettings(appSettingRows),
  };
};

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
export const upsertSyncConnection = async (
  database: SQLite.SQLiteDatabase,
  params: { apiUrl: string },
): Promise<void> => {
  await upsertAppSetting(database, SYNC_API_URL_KEY, params.apiUrl);
};

// 自動送信の一時停止を保存する。端末ローカル設定のため同期対象外。
export const setSyncPaused = async (
  database: SQLite.SQLiteDatabase,
  isPaused: boolean,
): Promise<void> => {
  await upsertAppSetting(database, SYNC_PAUSED_KEY, isPaused ? '1' : '0');
};

// 最終バックアップ日時を記録する。
export const markLastBackupAt = async (
  database: SQLite.SQLiteDatabase,
  timestamp: string,
): Promise<void> => {
  await upsertAppSetting(database, SYNC_LAST_BACKUP_AT_KEY, timestamp);
};

// ボディログを保存する。同じ計測日があれば上書き（1日1件）。
export const upsertBodyLog = async (
  database: SQLite.SQLiteDatabase,
  params: {
    id: string;
    measuredAt: string;
    bodyWeightKg: number;
    bodyFatPercentage: number | null;
  },
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'upsertBodyLog', async () => {
    await database.runAsync(
      `INSERT INTO body_logs
      (id, measured_at, body_weight_kg, body_fat_percentage, estimated_calories_burned, memo, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, '', ?, ?)
     ON CONFLICT(measured_at) DO UPDATE SET
       body_weight_kg = excluded.body_weight_kg,
       body_fat_percentage = excluded.body_fat_percentage,
       updated_at = excluded.updated_at`,
      params.id,
      params.measuredAt,
      params.bodyWeightKg,
      params.bodyFatPercentage,
      timestamp,
      timestamp,
    );
    // 計測日が既にある場合は既存行が更新される。送るのは実際に残った行の ID。
    const stored = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM body_logs WHERE measured_at = ?',
      params.measuredAt,
    );
    if (stored) {
      await enqueueUpsert(database, 'body_logs', stored.id);
    }
  });
};

// テンプレートと種目の並びをまとめて保存する。
export const insertTemplateDeep = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; name: string; exerciseEntries: { id: string; exerciseId: string }[] },
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'insertTemplateDeep', async () => {
    await database.runAsync(
      'INSERT INTO templates (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      params.id,
      params.name,
      timestamp,
      timestamp,
    );
    await enqueueUpsert(database, 'templates', params.id);
    for (const [index, entry] of params.exerciseEntries.entries()) {
      await database.runAsync(
        `INSERT INTO template_exercises
            (id, template_id, exercise_id, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
        entry.id,
        params.id,
        entry.exerciseId,
        index + 1,
        timestamp,
        timestamp,
      );
      await enqueueUpsert(database, 'template_exercises', entry.id);
    }
  });
};

export const deleteTemplateDeep = async (
  database: SQLite.SQLiteDatabase,
  templateId: string,
): Promise<void> => {
  await writeWithOutbox(database, 'deleteTemplateDeep', async () => {
    await database.runAsync('DELETE FROM template_exercises WHERE template_id = ?', templateId);
    await database.runAsync('DELETE FROM templates WHERE id = ?', templateId);
    // 子はサーバ側の外部キー（ON DELETE CASCADE）で消える。親の削除だけを送る。
    await enqueueDelete(database, 'templates', templateId);
  });
};

// タイマー設定（音・振動）を app_settings に保存する。
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
};

// ワークアウトの最終保存時刻を更新する（記録の都度保存）。
export const touchWorkout = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'touchWorkout', async () => {
    await database.runAsync(
      'UPDATE workouts SET last_saved_at = ?, updated_at = ? WHERE id = ?',
      timestamp,
      timestamp,
      workoutId,
    );
    await enqueueUpsert(database, 'workouts', workoutId);
  });
};

export const findActiveWorkoutRow = (database: SQLite.SQLiteDatabase): Promise<WorkoutRow | null> =>
  database.getFirstAsync<WorkoutRow>(
    `SELECT ${WORKOUT_COLUMNS} FROM workouts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`,
  );

export const insertWorkout = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; performedAt: string },
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'insertWorkout', async () => {
    await database.runAsync(
      'INSERT INTO workouts (id, performed_at, status, memo, last_saved_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params.id,
      params.performedAt,
      'active',
      '',
      timestamp,
      timestamp,
      timestamp,
    );
    await enqueueUpsert(database, 'workouts', params.id);
  });
};

/**
 * 予定を開始して実績へ移す。
 *
 * **performed_at は開始した日で上書きする。** 予定日と違う日に実施しても、
 * 記録は実施した日のものとして残るのが正しい（予定日のまま残すと履歴と集計がずれる）。
 */
export const startPlannedWorkout = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
  performedAt: string,
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'startPlannedWorkout', async () => {
    await database.runAsync(
      "UPDATE workouts SET status = 'active', performed_at = ?, last_saved_at = ?, updated_at = ? WHERE id = ? AND status = 'planned'",
      performedAt,
      timestamp,
      timestamp,
      workoutId,
    );
    await enqueueUpsert(database, 'workouts', workoutId);
  });
};

export const setWorkoutStatus = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
  status: 'active' | 'completed',
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'setWorkoutStatus', async () => {
    await database.runAsync(
      'UPDATE workouts SET status = ?, last_saved_at = ?, updated_at = ? WHERE id = ?',
      status,
      timestamp,
      timestamp,
      workoutId,
    );
    await enqueueUpsert(database, 'workouts', workoutId);
  });
};

// ワークアウトと、それに紐づく種目・セットをまとめて削除する。
export const deleteWorkoutDeep = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
  workoutExerciseIds: string[],
): Promise<void> => {
  await writeWithOutbox(database, 'deleteWorkoutDeep', async () => {
    for (const workoutExerciseId of workoutExerciseIds) {
      await database.runAsync(
        'DELETE FROM workout_sets WHERE workout_exercise_id = ?',
        workoutExerciseId,
      );
    }
    await database.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', workoutId);
    await database.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
    // 子はサーバ側の外部キー（ON DELETE CASCADE）で消える。親の削除だけを送る。
    await enqueueDelete(database, 'workouts', workoutId);
  });
};

export const insertWorkoutExercise = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; workoutId: string; exerciseId: string; orderIndex: number },
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'insertWorkoutExercise', async () => {
    await database.runAsync(
      `INSERT INTO workout_exercises
      (id, workout_id, exercise_id, order_index, rest_seconds_override, memo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params.id,
      params.workoutId,
      params.exerciseId,
      params.orderIndex,
      null,
      '',
      timestamp,
      timestamp,
    );
    await enqueueUpsert(database, 'workout_exercises', params.id);
  });
};

export const insertWorkoutSet = async (
  database: SQLite.SQLiteDatabase,
  params: {
    id: string;
    workoutExerciseId: string;
    orderIndex: number;
    weightKg: number;
    reps: number;
    rpe: number;
    restSeconds: number;
  },
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'insertWorkoutSet', async () => {
    await database.runAsync(
      `INSERT INTO workout_sets
      (id, workout_exercise_id, order_index, weight_kg, reps, rpe, is_warmup, is_completed, memo, rest_seconds, started_at, completed_at, deleted_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params.id,
      params.workoutExerciseId,
      params.orderIndex,
      params.weightKg,
      params.reps,
      params.rpe,
      0,
      0,
      '',
      params.restSeconds,
      timestamp,
      null,
      null,
      timestamp,
      timestamp,
    );
    await enqueueUpsert(database, 'workout_sets', params.id);
  });
};

// 完成済みのドメイン WorkoutSet を書き戻す。completed_at は完了状態に応じて設定。
export const updateWorkoutSet = async (
  database: SQLite.SQLiteDatabase,
  set: WorkoutSet,
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'updateWorkoutSet', async () => {
    await database.runAsync(
      `UPDATE workout_sets
     SET weight_kg = ?, reps = ?, rpe = ?, is_warmup = ?, is_completed = ?, memo = ?, rest_seconds = ?, deleted_at = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`,
      set.weightKg,
      set.reps,
      set.rpe,
      set.isWarmup ? 1 : 0,
      set.isCompleted ? 1 : 0,
      set.memo,
      set.restSeconds,
      set.deletedAt,
      set.isCompleted ? timestamp : null,
      timestamp,
      set.id,
    );
    // セットの削除は deleted_at による論理削除なので、削除も upsert として送る。
    await enqueueUpsert(database, 'workout_sets', set.id);
  });
};

/**
 * 論理削除したセットをまとめて戻す。
 *
 * **1トランザクションで処理する。** 1件ずつ updateWorkoutSet を呼ぶと、
 * 同じ接続でトランザクションが重なって失敗する（expo-sqlite はネストを許さない）。
 */
export const restoreWorkoutSets = async (
  database: SQLite.SQLiteDatabase,
  setIds: readonly string[],
): Promise<void> => {
  if (setIds.length === 0) {
    return;
  }
  const timestamp = nowIso();
  await writeWithOutbox(database, 'restoreWorkoutSets', async () => {
    for (const setId of setIds) {
      await database.runAsync(
        'UPDATE workout_sets SET deleted_at = NULL, updated_at = ? WHERE id = ?',
        timestamp,
        setId,
      );
      // 復元も「その行の最新状態」を送るだけでよい（後勝ち）。
      await enqueueUpsert(database, 'workout_sets', setId);
    }
  });
};

export const insertTimerEvent = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; workoutSetId: string; exerciseId: string; durationSeconds: number },
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'insertTimerEvent', async () => {
    await database.runAsync(
      `INSERT INTO timer_events
      (id, workout_set_id, exercise_id, duration_seconds, started_at, ended_at, status, sound_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params.id,
      params.workoutSetId,
      params.exerciseId,
      params.durationSeconds,
      timestamp,
      null,
      'running',
      1,
      timestamp,
      timestamp,
    );
    await enqueueUpsert(database, 'timer_events', params.id);
  });
};

// ユーザーが追加するカスタム種目。デフォルト値は既存実装に準拠。
export const insertExercise = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; name: string; primaryBodyPartId: string },
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'insertExercise', async () => {
    await database.runAsync(
      `INSERT INTO exercises
      (id, name, primary_body_part_id, default_rest_seconds, default_bar_weight_kg, category, is_archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params.id,
      params.name,
      params.primaryBodyPartId,
      120,
      0,
      'strength',
      0,
      timestamp,
      timestamp,
    );
    await enqueueUpsert(database, 'exercises', params.id);
  });
};

/**
 * 種目の設定を更新する（名前・部位・バー重量・アーカイブ）。
 *
 * **プリセット種目には使わない。** 全ユーザー共有の行でサーバが書き換えを拒むため、
 * 端末とサーバが静かに食い違う。呼び出し側で `isCustomExerciseId` を確かめること。
 */
export const updateExercise = async (
  database: SQLite.SQLiteDatabase,
  exercise: Exercise,
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'updateExercise', async () => {
    await database.runAsync(
      `UPDATE exercises
       SET name = ?, primary_body_part_id = ?, default_bar_weight_kg = ?, is_archived = ?, updated_at = ?
       WHERE id = ?`,
      exercise.name,
      exercise.primaryBodyPartId,
      exercise.defaultBarWeightKg,
      exercise.isArchived ? 1 : 0,
      timestamp,
      exercise.id,
    );
    await enqueueUpsert(database, 'exercises', exercise.id);
  });
};

export const setExerciseRest = async (
  database: SQLite.SQLiteDatabase,
  exerciseId: string,
  restSeconds: number,
): Promise<void> => {
  const timestamp = nowIso();
  await writeWithOutbox(database, 'setExerciseRest', async () => {
    await database.runAsync(
      'UPDATE exercises SET default_rest_seconds = ?, updated_at = ? WHERE id = ?',
      restSeconds,
      timestamp,
      exerciseId,
    );
    // プリセット種目は全ユーザー共有のためサーバ側では書き換えられない。
    // 現状、プリセットのレスト時間の変更は端末内にとどまる（ユーザー別の上書きは未実装）。
    if (isCustomExerciseId(exerciseId)) {
      await enqueueUpsert(database, 'exercises', exerciseId);
    }
  });
};
