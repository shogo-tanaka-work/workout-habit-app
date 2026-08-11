import type { BodyPart, Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { estimateOneRepMax } from './number';

// セット集計とサマリ（日別履歴・種目詳細・前回実績で共用する純粋関数群）。
//
// **ウォームアップ（isWarmup）は集計に入れない。** UI で WU を指定できるのに
// 総ボリュームへ算入されると、軽い準備セットを足すほど数字が実態から離れる。
// API 側 apps/api/src/analytics.ts も同じ規則。片方だけ変えない。

export type SetSummary = {
  /** ワーキングセットの数。ウォームアップは含めない。 */
  setCount: number;
  /** ウォームアップの数。集計からは外すが、やったこと自体は見せられるように持つ。 */
  warmupCount: number;
  totalReps: number;
  maxReps: number;
  totalVolume: number;
  bestOneRepMax: number;
};

export const summarizeSets = (sets: WorkoutSet[]): SetSummary => {
  let setCount = 0;
  let warmupCount = 0;
  let totalReps = 0;
  let maxReps = 0;
  let totalVolume = 0;
  let bestOneRepMax = 0;
  for (const set of sets) {
    if (set.isWarmup) {
      warmupCount += 1;
      continue;
    }
    setCount += 1;
    totalReps += set.reps;
    maxReps = Math.max(maxReps, set.reps);
    totalVolume += set.weightKg * set.reps;
    bestOneRepMax = Math.max(bestOneRepMax, estimateOneRepMax(set.weightKg, set.reps));
  }
  return { setCount, warmupCount, totalReps, maxReps, totalVolume, bestOneRepMax };
};

// 1回のワークアウトにおける、ある種目の実施記録（セット＋集計）。
export type ExerciseSession = {
  workout: Workout;
  sets: WorkoutSet[];
  summary: SetSummary;
};

const sortByOrderIndex = (a: WorkoutSet, b: WorkoutSet): number => a.orderIndex - b.orderIndex;

// 指定種目の実施履歴を新しい順に組み立てる。
// workouts は performedAt 降順（completedWorkouts）を渡す前提。
export const buildExerciseSessions = (
  exerciseId: string,
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  visibleSets: WorkoutSet[],
): ExerciseSession[] => {
  const sessions: ExerciseSession[] = [];
  for (const workout of workouts) {
    const workoutExercise = workoutExercises.find(
      (item) => item.workoutId === workout.id && item.exerciseId === exerciseId,
    );
    if (!workoutExercise) {
      continue;
    }
    const sets = visibleSets
      .filter((set) => set.workoutExerciseId === workoutExercise.id)
      .sort(sortByOrderIndex);
    if (sets.length === 0) {
      continue;
    }
    sessions.push({ workout, sets, summary: summarizeSets(sets) });
  }
  return sessions;
};

// 記録中の参照用に、現在のワークアウトを除いた直近の実施記録を返す。
export const findPreviousSession = (
  exerciseId: string,
  currentWorkoutId: string,
  completedWorkouts: Workout[],
  workoutExercises: WorkoutExercise[],
  visibleSets: WorkoutSet[],
): ExerciseSession | null => {
  for (const workout of completedWorkouts) {
    if (workout.id === currentWorkoutId) {
      continue;
    }
    const sessions = buildExerciseSessions(exerciseId, [workout], workoutExercises, visibleSets);
    if (sessions[0]) {
      return sessions[0];
    }
  }
  return null;
};

// 「70kg×8 / 70kg×8」のようなセット内容の短い表記。
export const formatSetsInline = (sets: WorkoutSet[]): string =>
  sets.map((set) => `${set.weightKg}kg×${set.reps}`).join(' / ');

// 部位別の集計（週間部位別集計などに使う）。
export type BodyPartSummary = {
  bodyPartId: string;
  name: string;
  setCount: number;
  totalVolume: number;
};

// 対象期間の workout_exercises と、それに属するセットから部位ごとの集計を作る。
// ボリューム降順で返す。
export const summarizeByBodyPart = (
  workoutExercises: WorkoutExercise[],
  sets: WorkoutSet[],
  exerciseById: Map<string, Exercise>,
  bodyPartById: Map<string, BodyPart>,
): BodyPartSummary[] => {
  const exerciseIdByWorkoutExerciseId = new Map(
    workoutExercises.map((item) => [item.id, item.exerciseId]),
  );
  const summaryByBodyPartId = new Map<string, BodyPartSummary>();
  for (const set of sets) {
    // ウォームアップは部位別ボリュームにも入れない（summarizeSets と同じ規則）。
    if (set.isWarmup) {
      continue;
    }
    const exerciseId = exerciseIdByWorkoutExerciseId.get(set.workoutExerciseId);
    if (!exerciseId) {
      continue;
    }
    const bodyPartId = exerciseById.get(exerciseId)?.primaryBodyPartId ?? 'unknown';
    const entry = summaryByBodyPartId.get(bodyPartId) ?? {
      bodyPartId,
      name: bodyPartById.get(bodyPartId)?.name ?? '未分類',
      setCount: 0,
      totalVolume: 0,
    };
    entry.setCount += 1;
    entry.totalVolume += set.weightKg * set.reps;
    summaryByBodyPartId.set(bodyPartId, entry);
  }
  return [...summaryByBodyPartId.values()].sort((a, b) => b.totalVolume - a.totalVolume);
};
