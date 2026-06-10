import type { Dataset, WorkoutSession } from '../types/domain';
import { listRecentWeekKeys, monthKeyOf, weekKeyOf } from '../utils/datetime';
import { estimateOneRepMax } from '../utils/number';

// セッション列から各セクションの表示用データを作る純粋関数群。
// ボリュームはモバイル側 summarizeSets と同様にウォームアップを含む全有効セットで計算する。

export type PeriodStat = {
  periodKey: string; // weekKey（月曜の dateKey）または monthKey（YYYY-MM）
  workoutCount: number;
  totalVolume: number;
  totalSetCount: number;
};

const sessionVolume = (session: WorkoutSession): number => {
  let volume = 0;
  for (const entry of session.entries) {
    for (const set of entry.sets) {
      volume += set.weightKg * set.reps;
    }
  }
  return volume;
};

const sessionSetCount = (session: WorkoutSession): number =>
  session.entries.reduce((acc, entry) => acc + entry.sets.length, 0);

const aggregateByPeriod = (
  sessions: WorkoutSession[],
  periodKeys: string[],
  periodKeyOf: (dateKey: string) => string,
): PeriodStat[] => {
  const statByPeriodKey = new Map<string, PeriodStat>(
    periodKeys.map((periodKey) => [
      periodKey,
      { periodKey, workoutCount: 0, totalVolume: 0, totalSetCount: 0 },
    ]),
  );
  for (const session of sessions) {
    const stat = statByPeriodKey.get(periodKeyOf(session.dateKey));
    if (!stat) {
      continue;
    }
    stat.workoutCount += 1;
    stat.totalVolume += sessionVolume(session);
    stat.totalSetCount += sessionSetCount(session);
  }
  return periodKeys.map((periodKey) => statByPeriodKey.get(periodKey)).filter(isDefined);
};

const isDefined = <Value>(value: Value | undefined): value is Value => value !== undefined;

export const weeklyStats = (sessions: WorkoutSession[], weekKeys: string[]): PeriodStat[] =>
  aggregateByPeriod(sessions, weekKeys, weekKeyOf);

export const monthlyStats = (sessions: WorkoutSession[], monthKeys: string[]): PeriodStat[] =>
  aggregateByPeriod(sessions, monthKeys, monthKeyOf);

// 部位別ボリューム（指定日以降）。ボリューム降順。
export type BodyPartVolume = {
  bodyPartId: string;
  name: string;
  setCount: number;
  totalVolume: number;
};

export const bodyPartVolumes = (dataset: Dataset, sinceDateKey: string): BodyPartVolume[] => {
  const bodyPartIdByExerciseId = new Map(
    dataset.exercises.map((exercise) => [exercise.id, exercise.primaryBodyPartId]),
  );
  const nameByBodyPartId = new Map(dataset.bodyParts.map((bodyPart) => [bodyPart.id, bodyPart.name]));
  const volumeByBodyPartId = new Map<string, BodyPartVolume>();
  for (const session of dataset.sessions) {
    if (session.dateKey < sinceDateKey) {
      continue;
    }
    for (const entry of session.entries) {
      const bodyPartId = bodyPartIdByExerciseId.get(entry.exerciseId) ?? 'unknown';
      const summary = volumeByBodyPartId.get(bodyPartId) ?? {
        bodyPartId,
        name: nameByBodyPartId.get(bodyPartId) ?? '未分類',
        setCount: 0,
        totalVolume: 0,
      };
      for (const set of entry.sets) {
        summary.setCount += 1;
        summary.totalVolume += set.weightKg * set.reps;
      }
      volumeByBodyPartId.set(bodyPartId, summary);
    }
  }
  return [...volumeByBodyPartId.values()].sort((a, b) => b.totalVolume - a.totalVolume);
};

// 種目セレクト用（実施回数の多い順）。
export type ExerciseOption = {
  exerciseId: string;
  name: string;
  sessionCount: number;
};

export const exerciseOptions = (dataset: Dataset): ExerciseOption[] => {
  const sessionCountByExerciseId = new Map<string, number>();
  for (const session of dataset.sessions) {
    for (const entry of session.entries) {
      sessionCountByExerciseId.set(
        entry.exerciseId,
        (sessionCountByExerciseId.get(entry.exerciseId) ?? 0) + 1,
      );
    }
  }
  const nameByExerciseId = new Map(dataset.exercises.map((exercise) => [exercise.id, exercise.name]));
  return [...sessionCountByExerciseId.entries()]
    .map(([exerciseId, sessionCount]) => ({
      exerciseId,
      name: nameByExerciseId.get(exerciseId) ?? '不明な種目',
      sessionCount,
    }))
    .sort((a, b) => b.sessionCount - a.sessionCount);
};

// 種目別の推移（セッションごと・日付昇順）。トップ重量と推定1RMはウォームアップを除く。
export type ExerciseSessionPoint = {
  dateKey: string;
  topWeightKg: number;
  bestOneRepMax: number;
  totalVolume: number;
};

export const exerciseSeries = (
  sessions: WorkoutSession[],
  exerciseId: string,
): ExerciseSessionPoint[] => {
  const points: ExerciseSessionPoint[] = [];
  for (const session of sessions) {
    const entry = session.entries.find((candidate) => candidate.exerciseId === exerciseId);
    if (!entry) {
      continue;
    }
    let topWeightKg = 0;
    let bestOneRepMax = 0;
    let totalVolume = 0;
    for (const set of entry.sets) {
      totalVolume += set.weightKg * set.reps;
      if (set.isWarmup) {
        continue;
      }
      topWeightKg = Math.max(topWeightKg, set.weightKg);
      bestOneRepMax = Math.max(bestOneRepMax, estimateOneRepMax(set.weightKg, set.reps));
    }
    points.push({ dateKey: session.dateKey, topWeightKg, bestOneRepMax, totalVolume });
  }
  return points;
};

// 継続状況: 今週から遡って「週1回以上実施」が連続している週数。
// 今週まだ0回の場合は先週から数える（週の途中で連続が切れた扱いにしない）。
export const weeklyStreak = (sessions: WorkoutSession[], today = new Date()): number => {
  const activeWeekKeys = new Set(sessions.map((session) => weekKeyOf(session.dateKey)));
  const LOOKBACK_WEEKS = 520; // 10年分あれば十分
  const recentWeekKeys = listRecentWeekKeys(LOOKBACK_WEEKS, today).reverse(); // 今週→過去
  let streak = 0;
  for (const [index, weekKey] of recentWeekKeys.entries()) {
    if (activeWeekKeys.has(weekKey)) {
      streak += 1;
      continue;
    }
    if (index === 0) {
      continue; // 今週はまだトレーニング前でも連続を切らない
    }
    break;
  }
  return streak;
};

// カレンダーヒートマップ用: dateKey → その日の総ボリューム。
export const volumeByDateKey = (sessions: WorkoutSession[]): Map<string, number> => {
  const volumeMap = new Map<string, number>();
  for (const session of sessions) {
    volumeMap.set(session.dateKey, (volumeMap.get(session.dateKey) ?? 0) + sessionVolume(session));
  }
  return volumeMap;
};
