import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { MonthCalendar } from '../components/MonthCalendar';
import { StatSummary } from '../components/StatSummary';
import { WorkoutExerciseList } from '../components/WorkoutExerciseList';
import { styles } from '../styles/appStyles';
import type { Exercise, SetPatch, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { summarizeSets } from '../utils/aggregate';
import { formatJapaneseDate } from '../utils/datetime';
import { formatCount, formatVolume, formatWeight } from '../utils/number';

export function HistoryScreen({
  workouts,
  workoutExercises,
  visibleSets,
  deletedSets,
  exerciseById,
  editingWorkoutId,
  onEdit,
  onStopEdit,
  onAddSet,
  onPatchSet,
  onRestoreSets,
  onStartRestTimer,
  onOpenRestPicker,
  onDeleteWorkout,
  onSelectExercise,
}: {
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  deletedSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  editingWorkoutId: string | null;
  onEdit: (workoutId: string) => void;
  onStopEdit: () => void;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onRestoreSets: (workoutExerciseId: string) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onSelectExercise: (exerciseId: string) => void;
}) {
  // カレンダーで選択中の日付。選択中はその日の記録だけを表示する。
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const confirmDelete = (workoutId: string, label: string) => {
    Alert.alert('記録を削除', `${label} の記録を削除します。元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDeleteWorkout(workoutId) },
    ]);
  };

  const workoutCountByDate = new Map<string, number>();
  for (const workout of workouts) {
    workoutCountByDate.set(
      workout.performedAt,
      (workoutCountByDate.get(workout.performedAt) ?? 0) + 1,
    );
  }
  const visibleWorkouts = selectedDate
    ? workouts.filter((workout) => workout.performedAt === selectedDate)
    : workouts;

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <MonthCalendar
          workoutCountByDate={workoutCountByDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </View>

      {selectedDate ? (
        <View style={styles.rowBetween}>
          <Text style={styles.accentNote}>{formatJapaneseDate(selectedDate)} の記録</Text>
          <Pressable style={styles.ghostButton} onPress={() => setSelectedDate(null)}>
            <Text style={styles.ghostButtonText}>すべて表示</Text>
          </Pressable>
        </View>
      ) : null}

      {workouts.length === 0 ? (
        <Text style={styles.muted}>
          完了した記録はまだありません。ワークアウトを完了すると、ここに履歴が並びます。
        </Text>
      ) : null}
      {visibleWorkouts.map((workout) => {
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
                  総ボリューム {formatVolume(workoutSummary.totalVolume)} ・{' '}
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
                  deletedSets={deletedSets}
                  exerciseById={exerciseById}
                  onAddSet={onAddSet}
                  onPatchSet={onPatchSet}
                  onRestoreSets={onRestoreSets}
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
                    <StatSummary
                      primary={{
                        label: 'ボリューム',
                        value: formatCount(itemSummary.totalVolume),
                        unit: 'kg',
                      }}
                      items={[
                        { label: 'セット', value: formatCount(itemSummary.setCount) },
                        { label: '推定1RM', value: formatWeight(itemSummary.bestOneRepMax) },
                        { label: 'レップ', value: formatCount(itemSummary.totalReps) },
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
