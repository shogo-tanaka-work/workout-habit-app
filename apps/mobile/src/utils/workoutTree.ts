import type { Exercise, WorkoutExercise, WorkoutSet } from '../types/domain';

// ワークアウト → 種目 → セットの階層を辿る。
//
// ここに置くのは「1行ずつ読めば分かる式を短くする」ためのものではない。
// 各画面が勝手に決めると食い違う規則（表示順・未知IDの扱い）だけを集める。
//
// セット1件の絞り込みのように、その場で読んだほうが速いものは各所に書いてよい。

/**
 * あるワークアウトに属する種目行を表示順で返す。
 *
 * `orderIndex` は削除で欠番が出るため、**表示上の連番には使わない**。
 * 連番は並べたあとの index から作る。
 */
export const exercisesInWorkout = (
  workoutId: string,
  workoutExercises: WorkoutExercise[],
): WorkoutExercise[] =>
  workoutExercises
    .filter((item) => item.workoutId === workoutId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

/**
 * 複数の種目行に属するセットをまとめて返す（種目をまたぐ集計の入力に使う）。
 * 種目ごとの順序は保たない。順序が要るなら種目行ごとに絞り込む。
 */
export const setsOfWorkoutExercises = (
  workoutExercises: WorkoutExercise[],
  sets: WorkoutSet[],
): WorkoutSet[] => {
  const itemIds = new Set(workoutExercises.map((item) => item.id));
  return sets.filter((set) => itemIds.has(set.workoutExerciseId));
};

/**
 * 種目名。未知の ID でも画面を壊さないよう既定値へ落とす。
 * アーカイブ済みや、マスタから消えた種目を参照する過去の記録があるため必ず通す。
 */
export const exerciseNameOf = (exerciseId: string, exerciseById: Map<string, Exercise>): string =>
  exerciseById.get(exerciseId)?.name ?? '種目';
