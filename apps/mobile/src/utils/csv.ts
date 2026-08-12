import type { BodyLog, Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';

// ワークアウト記録のCSVエクスポート（Phase 2）。
// 共有シート（Share API）でテキストとして書き出す前提のシリアライズ純粋関数。

const CSV_HEADER = 'date,exercise,set,weight_kg,reps,rpe,is_warmup,memo';

// カンマ・引用符・改行を含む値を RFC 4180 形式でエスケープする。
const escapeCsvValue = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export const buildWorkoutCsv = (
  completedWorkouts: Workout[],
  workoutExercises: WorkoutExercise[],
  visibleSets: WorkoutSet[],
  exerciseById: Map<string, Exercise>,
): string => {
  const rows: string[] = [CSV_HEADER];
  // 古い日付から順に出力する（分析ツールで扱いやすい順序）。
  const workoutsAscending = [...completedWorkouts].sort((a, b) =>
    a.performedAt.localeCompare(b.performedAt),
  );
  for (const workout of workoutsAscending) {
    const items = workoutExercises
      .filter((item) => item.workoutId === workout.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    for (const item of items) {
      const exerciseName = exerciseById.get(item.exerciseId)?.name ?? item.exerciseId;
      const sets = visibleSets
        .filter((set) => set.workoutExerciseId === item.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      sets.forEach((set, setIndex) => {
        rows.push(
          [
            workout.performedAt,
            escapeCsvValue(exerciseName),
            `${setIndex + 1}`,
            `${set.weightKg}`,
            `${set.reps}`,
            `${set.rpe}`,
            set.isWarmup ? '1' : '0',
            escapeCsvValue(set.memo),
          ].join(','),
        );
      });
    }
  }
  return rows.join('\n');
};

// ボディログのCSV。トレーニング記録とは列が違うため、別のファイル（別の文字列）にする。
const BODY_LOG_CSV_HEADER = 'date,body_weight_kg,body_fat_percentage,memo';

export const buildBodyLogCsv = (bodyLogs: BodyLog[]): string => {
  const rows: string[] = [BODY_LOG_CSV_HEADER];
  const ascending = [...bodyLogs].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  for (const log of ascending) {
    rows.push(
      [
        log.measuredAt,
        `${log.bodyWeightKg}`,
        log.bodyFatPercentage === null ? '' : `${log.bodyFatPercentage}`,
        escapeCsvValue(log.memo),
      ].join(','),
    );
  }
  return rows.join('\n');
};
