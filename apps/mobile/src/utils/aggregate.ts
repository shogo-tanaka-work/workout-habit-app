import type { Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { estimateOneRepMax } from './number';

// セット集計とサマリ（日別履歴・種目詳細・前回実績で共用する純粋関数群）。

export type SetSummary = {
  setCount: number;
  totalReps: number;
  maxReps: number;
  totalVolume: number;
  bestOneRepMax: number;
};

export const summarizeSets = (sets: WorkoutSet[]): SetSummary => {
  let totalReps = 0;
  let maxReps = 0;
  let totalVolume = 0;
  let bestOneRepMax = 0;
  for (const set of sets) {
    totalReps += set.reps;
    maxReps = Math.max(maxReps, set.reps);
    totalVolume += set.weightKg * set.reps;
    bestOneRepMax = Math.max(bestOneRepMax, estimateOneRepMax(set.weightKg, set.reps));
  }
  return { setCount: sets.length, totalReps, maxReps, totalVolume, bestOneRepMax };
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
