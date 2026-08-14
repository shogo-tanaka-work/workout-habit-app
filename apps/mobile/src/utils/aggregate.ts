import type { BodyPart, Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { estimateOneRepMax } from './number';
import { rmDivisorFor } from './oneRepMax';
import { exerciseNameOf } from './workoutTree';

// セット集計とサマリ（日別履歴・種目詳細・前回実績で共用する純粋関数群）。
//
// **ウォームアップ（isWarmup）は集計に入れない。** UI で WU を指定できるのに
// 総ボリュームへ算入されると、軽い準備セットを足すほど数字が実態から離れる。
// API 側 apps/api/src/analytics.ts も同じ規則。片方だけ変えない。

type SetSummary = {
  /** ワーキングセットの数。ウォームアップは含めない。 */
  setCount: number;
  /** ウォームアップの数。集計からは外すが、やったこと自体は見せられるように持つ。 */
  warmupCount: number;
  totalReps: number;
  maxReps: number;
  totalVolume: number;
  bestOneRepMax: number;
};

// rmDivisor は推定1RMの式の除数。種目が特定できる文脈では rmDivisorFor() の値を渡す
// （BIG3 だけ式が変わる）。複数種目が混ざる集計では既定の Epley 式のままでよい。
export const summarizeSets = (sets: WorkoutSet[], rmDivisor?: number): SetSummary => {
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
    bestOneRepMax = Math.max(bestOneRepMax, estimateOneRepMax(set.weightKg, set.reps, rmDivisor));
  }
  return { setCount, warmupCount, totalReps, maxReps, totalVolume, bestOneRepMax };
};

// 1回のワークアウトにおける、ある種目の実施記録（セット＋集計）。
export type ExerciseSession = {
  workout: Workout;
  sets: WorkoutSet[];
  summary: SetSummary;
};

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
      .sort((a, b) => a.orderIndex - b.orderIndex);
    if (sets.length === 0) {
      continue;
    }
    sessions.push({ workout, sets, summary: summarizeSets(sets, rmDivisorFor(exerciseId)) });
  }
  return sessions;
};

// 「70kg×8 / 70kg×8」のようなセット内容の短い表記。
export const formatSetsInline = (sets: WorkoutSet[]): string =>
  sets.map((set) => `${set.weightKg}kg×${set.reps}`).join(' / ');

// 期間集計（履歴タブ）。対象は渡された workouts に属するセットだけ。
//
// 履歴は期間（今週・1ヶ月…）で切り替わるので、期間で絞った workouts を受け取り、
// そこからセットを引き直す。絞り込みの条件は呼び出し側が持つ。

/** workoutExercise.id → workout.id の対応。期間フィルタでセットを引くのに使う。 */
const buildWorkoutIdBySetOwner = (workoutExercises: WorkoutExercise[]): Map<string, string> =>
  new Map(workoutExercises.map((item) => [item.id, item.workoutId]));

type PeriodSummary = SetSummary & {
  /** 期間内に実施したワークアウトの数。 */
  workoutCount: number;
};

export const summarizePeriod = (
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  sets: WorkoutSet[],
): PeriodSummary => {
  const workoutIds = new Set(workouts.map((workout) => workout.id));
  const workoutIdBySetOwner = buildWorkoutIdBySetOwner(workoutExercises);
  const periodSets = sets.filter((set) => {
    const workoutId = workoutIdBySetOwner.get(set.workoutExerciseId);
    return workoutId !== undefined && workoutIds.has(workoutId);
  });
  return { ...summarizeSets(periodSets), workoutCount: workouts.length };
};

// 期間内の種目別の積み上げ。行数が日数ではなく種目数で頭打ちになるので、
// 記録が増えても履歴のスクロール量が伸び続けない。
type ExerciseTotals = {
  exerciseId: string;
  name: string;
  bodyPartId: string | undefined;
  /** その種目を実施した回数（ワークアウト数）。 */
  sessionCount: number;
  summary: SetSummary;
};

// ボリューム降順で返す。セットが1つも無い種目は含めない。
export const summarizeByExercise = (
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  sets: WorkoutSet[],
  exerciseById: Map<string, Exercise>,
): ExerciseTotals[] => {
  const workoutIds = new Set(workouts.map((workout) => workout.id));
  const periodItems = workoutExercises.filter((item) => workoutIds.has(item.workoutId));
  const setsByOwner = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const bucket = setsByOwner.get(set.workoutExerciseId);
    if (bucket) {
      bucket.push(set);
    } else {
      setsByOwner.set(set.workoutExerciseId, [set]);
    }
  }

  const setsByExerciseId = new Map<string, WorkoutSet[]>();
  const sessionsByExerciseId = new Map<string, Set<string>>();
  for (const item of periodItems) {
    const itemSets = setsByOwner.get(item.id) ?? [];
    if (itemSets.length === 0) {
      continue;
    }
    setsByExerciseId.set(item.exerciseId, [
      ...(setsByExerciseId.get(item.exerciseId) ?? []),
      ...itemSets,
    ]);
    const sessions = sessionsByExerciseId.get(item.exerciseId) ?? new Set<string>();
    sessions.add(item.workoutId);
    sessionsByExerciseId.set(item.exerciseId, sessions);
  }

  return [...setsByExerciseId.entries()]
    .map(([exerciseId, exerciseSets]) => ({
      exerciseId,
      name: exerciseNameOf(exerciseId, exerciseById),
      bodyPartId: exerciseById.get(exerciseId)?.primaryBodyPartId,
      sessionCount: sessionsByExerciseId.get(exerciseId)?.size ?? 0,
      summary: summarizeSets(exerciseSets, rmDivisorFor(exerciseId)),
    }))
    .sort((a, b) => b.summary.totalVolume - a.summary.totalVolume);
};

// 総ボリュームの推移。1点＝1ワークアウト日、または1週間（古い→新しい順）。
export const buildVolumeSeries = (
  workouts: Workout[],
  workoutExercises: WorkoutExercise[],
  sets: WorkoutSet[],
  toBucketKey: (isoDate: string) => string,
): { date: string; value: number }[] => {
  const workoutIdBySetOwner = buildWorkoutIdBySetOwner(workoutExercises);
  const dateByWorkoutId = new Map(workouts.map((workout) => [workout.id, workout.performedAt]));
  const volumeByBucket = new Map<string, number>();
  for (const set of sets) {
    if (set.isWarmup) {
      continue;
    }
    const workoutId = workoutIdBySetOwner.get(set.workoutExerciseId);
    const performedAt = workoutId === undefined ? undefined : dateByWorkoutId.get(workoutId);
    if (performedAt === undefined) {
      continue;
    }
    const key = toBucketKey(performedAt);
    volumeByBucket.set(key, (volumeByBucket.get(key) ?? 0) + set.weightKg * set.reps);
  }
  return [...volumeByBucket.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// 部位別の集計（週間部位別集計などに使う）。
type BodyPartSummary = {
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
