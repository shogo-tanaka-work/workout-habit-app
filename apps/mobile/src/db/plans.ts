import type * as SQLite from 'expo-sqlite';

import type { SyncEntity } from './syncTables';
import { SYNC_COLUMNS } from './syncTables';

// 予定（status='planned'）の取り込み。Claude Code が API へ書いた計画を端末へ映す。
//
// **これは操作ではなく受信なので、outbox へは積まない。** 積むとサーバから来た内容を
// そのままサーバへ送り返すことになり、更新時刻だけが無意味に進む。
//
// 期間内の予定をまるごと置き換える（差分ではない）。サーバ側の削除は tombstone を
// 持たないため、「返ってこなかった予定は消えた」という形でしか伝えられない。
// 実績（active / completed）には触れない。端末の記録を上書きしないための境界。

const PLAN_ENTITIES = ['workouts', 'workout_exercises', 'workout_sets'] as const;

type PlanEntity = (typeof PLAN_ENTITIES)[number];

type PlansPayload = {
  from: string;
  to: string;
  fetchedAt: string;
  tables: Record<PlanEntity, Record<string, unknown>[]>;
};

type ImportPlansResult = {
  /** 端末へ入れた予定のワークアウト数。 */
  imported: number;
  /** すでに開始・完了していたため取り込まなかったワークアウト数。 */
  skipped: number;
};

const toSqlValue = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value === null || value === undefined ? null : String(value);
};

const isPlanPayload = (value: unknown): value is PlansPayload => {
  const tables = (value as PlansPayload | null)?.tables;
  return (
    typeof tables === 'object' &&
    tables !== null &&
    PLAN_ENTITIES.every((entity) => Array.isArray(tables[entity]))
  );
};

const normalizeBaseUrl = (apiUrl: string): string => apiUrl.trim().replace(/\/+$/, '');

/** 期間内の予定をサーバから取得する。期間は端末ローカル日付（YYYY-MM-DD）で渡す。 */
export const fetchPlansFromCloud = async (
  apiUrl: string,
  idToken: string,
  from: string,
  to: string,
): Promise<PlansPayload> => {
  const query = new URLSearchParams({ from, to }).toString();
  const response = await fetch(`${normalizeBaseUrl(apiUrl)}/plans?${query}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    throw new Error(`予定の取得に失敗しました (HTTP ${response.status})`);
  }
  const payload: unknown = await response.json();
  if (!isPlanPayload(payload)) {
    throw new Error('取得した予定の形式が不正です');
  }
  return payload;
};

const insertRows = async (
  database: SQLite.SQLiteDatabase,
  entity: SyncEntity,
  rows: readonly Record<string, unknown>[],
): Promise<void> => {
  // 端末側に無い列（サーバの source など）は落とす。列の正本は syncTables.ts。
  const columns = SYNC_COLUMNS[entity];
  const placeholders = columns.map(() => '?').join(', ');
  for (const row of rows) {
    await database.runAsync(
      `INSERT INTO ${entity} (${columns.join(', ')}) VALUES (${placeholders})`,
      ...columns.map((column) => toSqlValue(row[column])),
    );
  }
};

/**
 * 期間内の予定を、取得した内容で置き換える。
 *
 * すでに端末で開始・完了しているワークアウト（同じ ID で status が planned でないもの）は
 * **取り込まない**。予定を実行に移した直後、その変更がまだサーバへ届いていない状態で
 * 取り込むと、進行中の記録が予定で上書きされてしまう。
 */
export const replacePlannedWorkouts = async (
  database: SQLite.SQLiteDatabase,
  payload: PlansPayload,
): Promise<ImportPlansResult> => {
  const incomingWorkouts = payload.tables.workouts;
  const incomingIds = incomingWorkouts.map((row) => String(row.id));

  let result: ImportPlansResult = { imported: 0, skipped: 0 };
  try {
    await database.withTransactionAsync(async () => {
      // 置き換えの前に「端末が先へ進めた予定」を調べる。削除してからでは判別できない。
      const startedIds = new Set<string>();
      for (const workoutId of incomingIds) {
        const row = await database.getFirstAsync<{ status: string }>(
          'SELECT status FROM workouts WHERE id = ?',
          workoutId,
        );
        if (row && row.status !== 'planned') {
          startedIds.add(workoutId);
        }
      }

      // 期間内の既存の予定を子から消す（端末スキーマは外部キーの連鎖削除を持たない）。
      const rangeCondition = "status = 'planned' AND performed_at BETWEEN ? AND ?";
      await database.runAsync(
        `DELETE FROM workout_sets WHERE workout_exercise_id IN (
           SELECT id FROM workout_exercises WHERE workout_id IN (
             SELECT id FROM workouts WHERE ${rangeCondition}))`,
        payload.from,
        payload.to,
      );
      await database.runAsync(
        `DELETE FROM workout_exercises WHERE workout_id IN (
           SELECT id FROM workouts WHERE ${rangeCondition})`,
        payload.from,
        payload.to,
      );
      await database.runAsync(
        `DELETE FROM workouts WHERE ${rangeCondition}`,
        payload.from,
        payload.to,
      );

      const workouts = incomingWorkouts.filter((row) => !startedIds.has(String(row.id)));
      const keptWorkoutIds = new Set(workouts.map((row) => String(row.id)));
      const workoutExercises = payload.tables.workout_exercises.filter((row) =>
        keptWorkoutIds.has(String(row.workout_id)),
      );
      const keptExerciseIds = new Set(workoutExercises.map((row) => String(row.id)));
      const workoutSets = payload.tables.workout_sets.filter((row) =>
        keptExerciseIds.has(String(row.workout_exercise_id)),
      );

      await insertRows(database, 'workouts', workouts);
      await insertRows(database, 'workout_exercises', workoutExercises);
      await insertRows(database, 'workout_sets', workoutSets);

      result = { imported: workouts.length, skipped: startedIds.size };
    });
  } catch (error) {
    throw new Error(
      `replacePlannedWorkouts failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  return result;
};
