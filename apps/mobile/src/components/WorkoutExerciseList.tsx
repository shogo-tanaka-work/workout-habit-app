import { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { Exercise, SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';
import { summarizeSets } from '../utils/aggregate';
import { formatVolume, formatWeight } from '../utils/number';
import { rmDivisorFor } from '../utils/oneRepMax';
import { SetEditor } from './SetEditor';
import { exerciseNameOf } from '../utils/workoutTree';

// 1種目ぶんのカード。セットの絞り込みと集計を種目単位で useMemo するために、
// リストから分けている（リスト側のループ内では useMemo を書けない）。
const WorkoutExerciseSection = memo(function WorkoutExerciseSection({
  workoutExercise,
  visibleSets,
  exerciseById,
  onAddSet,
  onPatchSet,
}: {
  workoutExercise: WorkoutExercise;
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
}) {
  const exerciseName = exerciseNameOf(workoutExercise.exerciseId, exerciseById);
  const sets = useMemo(
    () =>
      visibleSets
        .filter((set) => set.workoutExerciseId === workoutExercise.id)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [visibleSets, workoutExercise.id],
  );
  // ウォームアップを除いた集計。規則は utils/aggregate.ts に集約している。
  const summary = useMemo(
    () => summarizeSets(sets, rmDivisorFor(workoutExercise.exerciseId)),
    [sets, workoutExercise.exerciseId],
  );
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <Text style={styles.exerciseTitle}>{exerciseName}</Text>
          <Text style={styles.faint}>
            {summary.setCount} セット
            {summary.warmupCount > 0 ? `（＋WU ${summary.warmupCount}）` : ''} ・{' '}
            {formatVolume(summary.totalVolume)} ・ 推定1RM {formatWeight(summary.bestOneRepMax)}
          </Text>
        </View>
        <Pressable style={styles.smallButton} onPress={() => onAddSet(workoutExercise)}>
          <Text style={styles.smallButtonText}>＋ セット</Text>
        </Pressable>
      </View>
      <View style={styles.sectionBody}>
        {sets.length === 0 ? (
          <Text style={styles.muted}>セットを追加すると、すぐ保存されます。</Text>
        ) : null}
        {sets.map((set, index) => (
          <SetEditor
            key={set.id}
            set={set}
            setNumber={index + 1}
            workoutExercise={workoutExercise}
            onPatchSet={onPatchSet}
          />
        ))}
      </View>
    </View>
  );
});

// 過去の記録を直すときの種目リスト（WorkoutEditScreen 専用）。
//
// 記録中の入力は ExerciseLogPanel が受け持つ。こちらは編集だけなので、
// 休憩タイマーと前回実績は持たない（どちらも「これからやる」ための表示）。
export const WorkoutExerciseList = memo(function WorkoutExerciseList({
  workoutExercises,
  visibleSets,
  exerciseById,
  onAddSet,
  onPatchSet,
}: {
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
}) {
  return (
    <>
      {workoutExercises.map((workoutExercise) => (
        <WorkoutExerciseSection
          key={workoutExercise.id}
          workoutExercise={workoutExercise}
          visibleSets={visibleSets}
          exerciseById={exerciseById}
          onAddSet={onAddSet}
          onPatchSet={onPatchSet}
        />
      ))}
    </>
  );
});
