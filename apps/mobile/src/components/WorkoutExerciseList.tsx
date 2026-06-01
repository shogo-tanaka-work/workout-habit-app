import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { Exercise, SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';
import { formatTimer } from '../utils/format';
import { estimateOneRepMax } from '../utils/number';
import { SetEditor } from './SetEditor';

export function WorkoutExerciseList({
  workoutExercises,
  visibleSets,
  exerciseById,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
  showTimer,
}: {
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  showTimer: boolean;
}) {
  return (
    <>
      {workoutExercises.map((workoutExercise) => {
        const exercise = exerciseById.get(workoutExercise.exerciseId);
        const sets = visibleSets
          .filter((set) => set.workoutExerciseId === workoutExercise.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        const volume = sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
        const bestOneRepMax = sets.reduce(
          (best, set) => Math.max(best, estimateOneRepMax(set.weightKg, set.reps)),
          0,
        );
        const restSeconds =
          workoutExercise.restSecondsOverride ?? exercise?.defaultRestSeconds ?? 120;
        return (
          <View key={workoutExercise.id} style={styles.panel}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.exerciseTitle}>{exercise?.name ?? '種目'}</Text>
                <Text style={styles.muted}>
                  {sets.length} セット / {Math.round(volume).toLocaleString()}kg / 推定1RM{' '}
                  {bestOneRepMax}kg
                </Text>
              </View>
              <Pressable style={styles.smallButton} onPress={() => onAddSet(workoutExercise)}>
                <Text style={styles.smallButtonText}>+ セット</Text>
              </Pressable>
            </View>
            {showTimer ? (
              <Pressable
                style={styles.restRow}
                onPress={() => exercise && onOpenRestPicker(exercise.id, restSeconds)}
              >
                <Text style={styles.muted}>休憩タイマー</Text>
                <Text style={styles.restValue}>{formatTimer(restSeconds)} ›</Text>
              </Pressable>
            ) : null}
            {sets.length === 0 ? (
              <Text style={styles.muted}>セットを追加すると、すぐ保存されます。</Text>
            ) : null}
            {sets.map((set) => (
              <SetEditor
                key={set.id}
                set={set}
                workoutExercise={workoutExercise}
                onPatchSet={onPatchSet}
                onStartRestTimer={onStartRestTimer}
                showTimer={showTimer}
              />
            ))}
          </View>
        );
      })}
    </>
  );
}
