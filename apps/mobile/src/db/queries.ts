import type * as SQLite from 'expo-sqlite';

import type { BodyPart, Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import type {
  BodyPartRow,
  ExerciseRow,
  WorkoutRow,
  WorkoutExerciseRow,
  WorkoutSetRow,
} from '../types/db';
import { nowIso } from '../utils/datetime';
import { toBodyPart, toExercise, toWorkout, toWorkoutExercise, toWorkoutSet } from './mappers';

export type WorkoutData = {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
};

// すべてのテーブルを読み込みドメイン型へ変換して返す。
// NOTE: SELECT * は行型と一致している前提。data-persistence.md の方針では
// 明示カラム指定が望ましく、将来的に列挙へ置き換える余地がある。
export const loadWorkoutData = async (database: SQLite.SQLiteDatabase): Promise<WorkoutData> => {
  const [bodyPartRows, exerciseRows, workoutRows, workoutExerciseRows, workoutSetRows] =
    await Promise.all([
      database.getAllAsync<BodyPartRow>('SELECT * FROM body_parts ORDER BY order_index'),
      database.getAllAsync<ExerciseRow>(
        'SELECT * FROM exercises WHERE is_archived = 0 ORDER BY name',
      ),
      database.getAllAsync<WorkoutRow>('SELECT * FROM workouts ORDER BY created_at DESC'),
      database.getAllAsync<WorkoutExerciseRow>(
        'SELECT * FROM workout_exercises ORDER BY order_index',
      ),
      database.getAllAsync<WorkoutSetRow>('SELECT * FROM workout_sets ORDER BY order_index'),
    ]);
  return {
    bodyParts: bodyPartRows.map(toBodyPart),
    exercises: exerciseRows.map(toExercise),
    workouts: workoutRows.map(toWorkout),
    workoutExercises: workoutExerciseRows.map(toWorkoutExercise),
    workoutSets: workoutSetRows.map(toWorkoutSet),
  };
};

// ワークアウトの最終保存時刻を更新する（記録の都度保存）。
export const touchWorkout = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
): Promise<void> => {
  await database.runAsync(
    'UPDATE workouts SET last_saved_at = ?, updated_at = ? WHERE id = ?',
    nowIso(),
    nowIso(),
    workoutId,
  );
};

export const findActiveWorkoutRow = (database: SQLite.SQLiteDatabase): Promise<WorkoutRow | null> =>
  database.getFirstAsync<WorkoutRow>(
    "SELECT * FROM workouts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1",
  );

export const insertWorkout = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; performedAt: string },
): Promise<void> => {
  const timestamp = nowIso();
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
};

export const setWorkoutStatus = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
  status: 'active' | 'completed',
): Promise<void> => {
  await database.runAsync(
    'UPDATE workouts SET status = ?, last_saved_at = ?, updated_at = ? WHERE id = ?',
    status,
    nowIso(),
    nowIso(),
    workoutId,
  );
};

// ワークアウトと、それに紐づく種目・セットをまとめて削除する。
export const deleteWorkoutDeep = async (
  database: SQLite.SQLiteDatabase,
  workoutId: string,
  workoutExerciseIds: string[],
): Promise<void> => {
  for (const workoutExerciseId of workoutExerciseIds) {
    await database.runAsync(
      'DELETE FROM workout_sets WHERE workout_exercise_id = ?',
      workoutExerciseId,
    );
  }
  await database.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', workoutId);
  await database.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
};

export const insertWorkoutExercise = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; workoutId: string; exerciseId: string; orderIndex: number },
): Promise<void> => {
  const timestamp = nowIso();
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
};

// 完成済みのドメイン WorkoutSet を書き戻す。completed_at は完了状態に応じて設定。
export const updateWorkoutSet = async (
  database: SQLite.SQLiteDatabase,
  set: WorkoutSet,
): Promise<void> => {
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
    set.isCompleted ? nowIso() : null,
    nowIso(),
    set.id,
  );
};

export const insertTimerEvent = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; workoutSetId: string; exerciseId: string; durationSeconds: number },
): Promise<void> => {
  const timestamp = nowIso();
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
};

// ユーザーが追加するカスタム種目。デフォルト値は既存実装に準拠。
export const insertExercise = async (
  database: SQLite.SQLiteDatabase,
  params: { id: string; name: string; primaryBodyPartId: string },
): Promise<void> => {
  const timestamp = nowIso();
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
};

export const setExerciseRest = async (
  database: SQLite.SQLiteDatabase,
  exerciseId: string,
  restSeconds: number,
): Promise<void> => {
  await database.runAsync(
    'UPDATE exercises SET default_rest_seconds = ?, updated_at = ? WHERE id = ?',
    restSeconds,
    nowIso(),
    exerciseId,
  );
};
