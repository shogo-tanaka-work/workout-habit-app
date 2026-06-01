import { Alert, Pressable, Text, View } from 'react-native';

import { Metric } from '../components/Metric';
import { WorkoutExerciseList } from '../components/WorkoutExerciseList';
import { styles } from '../styles/appStyles';
import type { Exercise, SetPatch, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { estimateOneRepMax } from '../utils/number';

export function HistoryScreen({
  workouts,
  workoutExercises,
  visibleSets,
  exerciseById,
  editingWorkoutId,
  onEdit,
  onStopEdit,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
  onDeleteWorkout,
}: {
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  editingWorkoutId: string | null;
  onEdit: (workoutId: string) => void;
  onStopEdit: () => void;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  onDeleteWorkout: (workoutId: string) => void;
}) {
  const confirmDelete = (workoutId: string, label: string) => {
    Alert.alert('記録を削除', `${label} の記録を削除します。元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDeleteWorkout(workoutId) },
    ]);
  };

  return (
    <View style={styles.stack}>
      <Text style={styles.pageTitle}>履歴</Text>
      {workouts.length === 0 ? (
        <Text style={styles.muted}>完了したワークアウトはまだありません。</Text>
      ) : null}
      {workouts.map((workout) => {
        const items = workoutExercises
          .filter((item) => item.workoutId === workout.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        const sets = visibleSets.filter((set) =>
          items.some((item) => item.id === set.workoutExerciseId),
        );
        const totalVolume = sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
        const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
        const isEditing = editingWorkoutId === workout.id;
        return (
          <View key={workout.id} style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>{workout.performedAt}</Text>
              {isEditing ? (
                <Pressable style={styles.secondaryButton} onPress={onStopEdit}>
                  <Text style={styles.secondaryButtonText}>編集を終了</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.ghostButton} onPress={() => onEdit(workout.id)}>
                  <Text style={styles.ghostButtonText}>編集</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.metricGrid}>
              <Metric label="種目" value={`${items.length}`} />
              <Metric label="セット" value={`${sets.length}`} />
              <Metric label="総レップ" value={`${totalReps}`} />
              <Metric label="ボリューム" value={`${Math.round(totalVolume).toLocaleString()}kg`} />
            </View>
            {isEditing ? (
              <>
                <WorkoutExerciseList
                  workoutExercises={items}
                  visibleSets={visibleSets}
                  exerciseById={exerciseById}
                  onAddSet={onAddSet}
                  onPatchSet={onPatchSet}
                  onStartRestTimer={onStartRestTimer}
                  onOpenRestPicker={onOpenRestPicker}
                  showTimer={false}
                />
                <Pressable
                  style={styles.dangerButton}
                  onPress={() => confirmDelete(workout.id, workout.performedAt)}
                >
                  <Text style={styles.dangerButtonText}>この記録を削除</Text>
                </Pressable>
              </>
            ) : (
              items.map((item) => {
                const exercise = exerciseById.get(item.exerciseId);
                const itemSets = sets.filter((set) => set.workoutExerciseId === item.id);
                const best = itemSets.reduce(
                  (max, set) => Math.max(max, estimateOneRepMax(set.weightKg, set.reps)),
                  0,
                );
                return (
                  <View key={item.id} style={styles.historyItem}>
                    <Text style={styles.historyTitle}>{exercise?.name ?? '種目'}</Text>
                    <Text style={styles.muted}>
                      {itemSets.length} セット / 推定1RM {best}kg /{' '}
                      {itemSets.map((set) => `${set.weightKg}kgx${set.reps}`).join(', ')}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );
}
