import type { BackupPayload, BackupRow } from '../types/db';
import type {
  BodyLog,
  BodyPart,
  CompletedSet,
  Dataset,
  Exercise,
  SessionEntry,
  WorkoutSession,
} from '../types/domain';
import { toDateKey } from '../utils/datetime';

// バックアップ生データ（snake_case・unknown）→ ドメイン型への変換を一手に引き受ける。
// 型アサーションはこのファイルの読み取りヘルパーに閉じ込める。

const textOf = (row: BackupRow, column: string): string => {
  const value = row[column];
  return typeof value === 'string' ? value : '';
};

const numberOf = (row: BackupRow, column: string): number => {
  const value = row[column];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
};

const nullableNumberOf = (row: BackupRow, column: string): number | null => {
  const value = row[column];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const truthyFlagOf = (row: BackupRow, column: string): boolean => numberOf(row, column) !== 0;

const rowsOf = (payload: BackupPayload, tableName: string): BackupRow[] =>
  payload.tables[tableName] ?? [];

const toBodyPart = (row: BackupRow): BodyPart => ({
  id: textOf(row, 'id'),
  name: textOf(row, 'name'),
  orderIndex: numberOf(row, 'order_index'),
});

const toExercise = (row: BackupRow): Exercise => ({
  id: textOf(row, 'id'),
  name: textOf(row, 'name'),
  primaryBodyPartId: textOf(row, 'primary_body_part_id'),
});

const toBodyLog = (row: BackupRow): BodyLog => ({
  dateKey: toDateKey(textOf(row, 'measured_at')),
  bodyWeightKg: nullableNumberOf(row, 'body_weight_kg'),
  bodyFatPercentage: nullableNumberOf(row, 'body_fat_percentage'),
});

const WORKOUT_STATUS_COMPLETED = 'completed';

const compareByDateKey = <Item extends { dateKey: string }>(a: Item, b: Item): number =>
  a.dateKey.localeCompare(b.dateKey);

// 完了済みワークアウトを、種目エントリ＋有効セット（削除済み除外）付きで組み立てる。
const buildSessions = (payload: BackupPayload): WorkoutSession[] => {
  const setsByWorkoutExerciseId = new Map<string, CompletedSet[]>();
  for (const row of rowsOf(payload, 'workout_sets')) {
    if (row['deleted_at'] !== null || !truthyFlagOf(row, 'is_completed')) {
      continue;
    }
    const workoutExerciseId = textOf(row, 'workout_exercise_id');
    const sets = setsByWorkoutExerciseId.get(workoutExerciseId) ?? [];
    sets.push({
      weightKg: numberOf(row, 'weight_kg'),
      reps: numberOf(row, 'reps'),
      isWarmup: truthyFlagOf(row, 'is_warmup'),
    });
    setsByWorkoutExerciseId.set(workoutExerciseId, sets);
  }

  const entriesByWorkoutId = new Map<string, SessionEntry[]>();
  const sortedWorkoutExercises = [...rowsOf(payload, 'workout_exercises')].sort(
    (a, b) => numberOf(a, 'order_index') - numberOf(b, 'order_index'),
  );
  for (const row of sortedWorkoutExercises) {
    const sets = setsByWorkoutExerciseId.get(textOf(row, 'id')) ?? [];
    if (sets.length === 0) {
      continue;
    }
    const workoutId = textOf(row, 'workout_id');
    const entries = entriesByWorkoutId.get(workoutId) ?? [];
    entries.push({ exerciseId: textOf(row, 'exercise_id'), sets });
    entriesByWorkoutId.set(workoutId, entries);
  }

  const sessions: WorkoutSession[] = [];
  for (const row of rowsOf(payload, 'workouts')) {
    if (textOf(row, 'status') !== WORKOUT_STATUS_COMPLETED) {
      continue;
    }
    const workoutId = textOf(row, 'id');
    const entries = entriesByWorkoutId.get(workoutId) ?? [];
    if (entries.length === 0) {
      continue;
    }
    sessions.push({ id: workoutId, dateKey: toDateKey(textOf(row, 'performed_at')), entries });
  }
  return sessions.sort(compareByDateKey);
};

export const toDataset = (payload: BackupPayload): Dataset => ({
  exportedAt: payload.exportedAt,
  bodyParts: rowsOf(payload, 'body_parts')
    .map(toBodyPart)
    .sort((a, b) => a.orderIndex - b.orderIndex),
  exercises: rowsOf(payload, 'exercises').map(toExercise),
  sessions: buildSessions(payload),
  bodyLogs: rowsOf(payload, 'body_logs').map(toBodyLog).sort(compareByDateKey),
});
