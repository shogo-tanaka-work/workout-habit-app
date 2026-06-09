import { Alert, Pressable, Text, View } from 'react-native';

import { StatStrip } from '../components/StatStrip';
import { WorkoutExerciseList } from '../components/WorkoutExerciseList';
import { styles } from '../styles/appStyles';
import type { Exercise, SetPatch, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { summarizeSets } from '../utils/aggregate';
import { formatJapaneseDate } from '../utils/datetime';

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
  onSelectExercise,
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
  onSelectExercise: (exerciseId: string) => void;
}) {
  const confirmDelete = (workoutId: string, label: string) => {
    Alert.alert('記録を削除', `${label} の記録を削除します。元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDeleteWorkout(workoutId) },
    ]);
  };

  return (
    <View style={styles.stack}>
      {workouts.length === 0 ? (
        <Text style={styles.muted}>完了したワークアウトはまだありません。</Text>
      ) : null}
      {workouts.map((workout) => {
        const items = workoutExercises
          .filter((item) => item.workoutId === workout.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        const workoutSets = visibleSets.filter((set) =>
          items.some((item) => item.id === set.workoutExerciseId),
        );
        const workoutSummary = summarizeSets(workoutSets);
        const isEditing = editingWorkoutId === workout.id;
        return (
          <View key={workout.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionHeaderText}>
                  {formatJapaneseDate(workout.performedAt)}
                </Text>
                <Text style={styles.faint}>
                  総ボリューム {Math.round(workoutSummary.totalVolume).toLocaleString()} kg ・{' '}
                  {workoutSummary.setCount} セット
                </Text>
              </View>
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
            {isEditing ? (
              <View style={styles.sectionBody}>
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
              </View>
            ) : (
              items.map((item) => {
                const exercise = exerciseById.get(item.exerciseId);
                const itemSets = workoutSets.filter((set) => set.workoutExerciseId === item.id);
                const itemSummary = summarizeSets(itemSets);
                return (
                  <Pressable
                    key={item.id}
                    style={styles.exerciseRow}
                    onPress={() => onSelectExercise(item.exerciseId)}
                  >
                    <View style={styles.exerciseRowHeader}>
                      <View style={styles.exerciseDot} />
                      <Text style={styles.exerciseRowName}>{exercise?.name ?? '種目'}</Text>
                      <Text style={styles.chevron}>›</Text>
                    </View>
                    <StatStrip
                      items={[
                        { label: 'セット', value: `${itemSummary.setCount} セット` },
                        {
                          label: 'ボリューム',
                          value: `${Math.round(itemSummary.totalVolume).toLocaleString()} kg`,
                        },
                        { label: '推定1RM', value: `${itemSummary.bestOneRepMax} kg` },
                        { label: '総レップ数', value: `${itemSummary.totalReps} 回` },
                        { label: '最大レップ', value: `${itemSummary.maxReps} 回` },
                      ]}
                    />
                  </Pressable>
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );
}
