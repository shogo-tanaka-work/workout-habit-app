import type * as SQLite from 'expo-sqlite';

import type { Exercise, WorkoutSet } from '../types/domain';
import { nowIso } from '../utils/datetime';
import { newId } from '../utils/id';
import { enqueueDelete, enqueueUpsert } from './outbox';

/**
 * 書き込みを1トランザクションで実行し、失敗したら操作名つきのエラーへ包む。
 *
 * **この関数は outbox への登録をしない。** 登録は `write` の中で
 * `enqueueUpsert` / `enqueueDelete` を呼ぶ側の責任。名前に反して面倒を見てくれると
 * 誤解すると、ローカルにだけ残ってサーバへ永遠に届かない行ができる
 * （同期のズレとしてしか観測できず、気づくのが遅れる）。
 *
 * 端末の書き込みは「ローカルへ即時反映 ＋ 送信キューへ積む」をひとまとまりで行う。
 * 画面はローカルの結果だけを見て進み、送信は src/sync/pusher.ts が契機ごとに引き受ける。
 */
const writeInTransaction = async (
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
  await writeInTransaction(database, 'upsertBodyLog', async () => {
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
  await writeInTransaction(database, 'insertTemplateDeep', async () => {
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
  await writeInTransaction(database, 'deleteTemplateDeep', async () => {
    await database.runAsync('DELETE FROM template_exercises WHERE template_id = ?', templateId);
    await database.runAsync('DELETE FROM templates WHERE id = ?', templateId);
    // 子はサーバ側の外部キー（ON DELETE CASCADE）で消える。親の削除だけを送る。
    await enqueueDelete(database, 'templates', templateId);
  });
};

export const touchWorkout = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
): Promise<void> => {
  const timestamp = nowIso();
  await writeInTransaction(database, 'touchWorkout', async () => {
    await database.runAsync(
      'UPDATE workouts SET last_saved_at = ?, updated_at = ? WHERE id = ?',
      timestamp,
      timestamp,
      workoutId,
    );
    await enqueueUpsert(database, 'workouts', workoutId);
  });
};

export const insertWorkout = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; performedAt: string },
): Promise<void> => {
  const timestamp = nowIso();
  await writeInTransaction(database, 'insertWorkout', async () => {
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
  await writeInTransaction(database, 'startPlannedWorkout', async () => {
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
  await writeInTransaction(database, 'setWorkoutStatus', async () => {
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
/**
 * ワークアウトを子ごと消す。
 *
 * **子の特定は SQL で完結させる。** かつては呼び出し側が React state から集めた
 * workout_exercise の ID を渡していたが、state が DB より古いと渡し漏れた行の
 * セットだけが孤児として残り、どの画面にも出ないまま残り続けていた。
 */
export const deleteWorkoutDeep = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
): Promise<void> => {
  await writeInTransaction(database, 'deleteWorkoutDeep', async () => {
    await database.runAsync(
      `DELETE FROM workout_sets
       WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)`,
      workoutId,
    );
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
  await writeInTransaction(database, 'insertWorkoutExercise', async () => {
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
  await writeInTransaction(database, 'insertWorkoutSet', async () => {
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
  await writeInTransaction(database, 'updateWorkoutSet', async () => {
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

export const insertTimerEvent = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; workoutSetId: string; exerciseId: string; durationSeconds: number },
): Promise<void> => {
  const timestamp = nowIso();
  await writeInTransaction(database, 'insertTimerEvent', async () => {
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
  await writeInTransaction(database, 'insertExercise', async () => {
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
  await writeInTransaction(database, 'updateExercise', async () => {
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

/**
 * 共有プリセット種目の上書きを保存する（1行を丸ごと置き換える）。
 *
 * プリセットは全ユーザー共有の行でサーバが書き換えを拒むため、
 * 上書きを別テーブルに持つ。`null` を渡した項目は「上書きしない」に戻る。
 */
export const upsertUserExerciseSetting = async (
  database: SQLite.SQLiteDatabase,
  params: {
    exerciseId: string;
    restSeconds: number | null;
    barWeightKg: number | null;
    isArchived: boolean | null;
  },
): Promise<void> => {
  const timestamp = nowIso();
  await writeInTransaction(database, 'upsertUserExerciseSetting', async () => {
    // 既存があればその id を使い回す。新しい id を振ると UNIQUE(exercise_id) に当たる。
    const existing = await database.getFirstAsync<{ id: string }>(
      'SELECT id FROM user_exercise_settings WHERE exercise_id = ?',
      params.exerciseId,
    );
    const id = existing?.id ?? newId('ues');
    await database.runAsync(
      `INSERT INTO user_exercise_settings
        (id, exercise_id, rest_seconds, bar_weight_kg, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         rest_seconds = excluded.rest_seconds,
         bar_weight_kg = excluded.bar_weight_kg,
         is_archived = excluded.is_archived,
         updated_at = excluded.updated_at`,
      id,
      params.exerciseId,
      params.restSeconds,
      params.barWeightKg,
      params.isArchived === null ? null : params.isArchived ? 1 : 0,
      timestamp,
      timestamp,
    );
    await enqueueUpsert(database, 'user_exercise_settings', id);
  });
};

/** レスト時間の変更。**カスタム種目専用**（プリセットは upsertUserExerciseSetting を使う）。 */
export const setExerciseRest = async (
  database: SQLite.SQLiteDatabase,
  exerciseId: string,
  restSeconds: number,
): Promise<void> => {
  const timestamp = nowIso();
  await writeInTransaction(database, 'setExerciseRest', async () => {
    await database.runAsync(
      'UPDATE exercises SET default_rest_seconds = ?, updated_at = ? WHERE id = ?',
      restSeconds,
      timestamp,
      exerciseId,
    );
    await enqueueUpsert(database, 'exercises', exerciseId);
  });
};
