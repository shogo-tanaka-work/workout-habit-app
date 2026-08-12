import { Alert, Pressable, Text, View } from 'react-native';

import { BodyLogSection } from '../components/BodyLogSection';
import { StatSummary } from '../components/StatSummary';
import { WorkoutExerciseList } from '../components/WorkoutExerciseList';
import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type {
  BodyLog,
  Exercise,
  SetPatch,
  WeeklyStats,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import type { BodyPartSummary } from '../utils/aggregate';
import { summarizeSets } from '../utils/aggregate';
import { formatJapaneseDate } from '../utils/datetime';
import { formatCount, formatVolume, formatWeight } from '../utils/number';

// 履歴は「振り返り」の画面。日々の実績の入口はホームのカレンダーが持ち、
// ここは週次の集計・体組成の推移と、過去の記録の一覧・編集を担う。
export function HistoryScreen({
  workouts,
  workoutExercises,
  visibleSets,
  exerciseById,
  stats,
  bodyPartSummaries,
  bodyLogs,
  editingWorkoutId,
  onEdit,
  onStopEdit,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
  onDeleteWorkout,
  onSelectExercise,
  onSaveBodyLog,
}: {
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  stats: WeeklyStats;
  bodyPartSummaries: BodyPartSummary[];
  bodyLogs: BodyLog[];
  editingWorkoutId: string | null;
  onEdit: (workoutId: string) => void;
  onStopEdit: () => void;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onSelectExercise: (exerciseId: string) => void;
  onSaveBodyLog: (bodyWeightKg: number, bodyFatPercentage: number | null) => void;
}) {
  const maxBodyPartVolume = bodyPartSummaries.reduce(
    (max, summary) => Math.max(max, summary.totalVolume),
    0,
  );

  const confirmDelete = (workoutId: string, label: string) => {
    Alert.alert('記録を削除', `${label} の記録を削除します。元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDeleteWorkout(workoutId) },
    ]);
  };

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>今週のトレーニング</Text>
        </View>
        <StatSummary
          primary={{ label: '総ボリューム', value: formatCount(stats.totalVolume), unit: 'kg' }}
          items={[
            { label: '記録', value: formatCount(stats.workoutCount), unit: '回' },
            { label: 'セット', value: formatCount(stats.setCount) },
            { label: 'レップ', value: formatCount(stats.totalReps) },
          ]}
        />
        {bodyPartSummaries.length > 0 ? (
          <View style={styles.sectionBody}>
            {bodyPartSummaries.map((summary) => {
              const ratio = maxBodyPartVolume > 0 ? summary.totalVolume / maxBodyPartVolume : 0;
              return (
                <View key={summary.bodyPartId} style={styles.bodyPartRow}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.panelText}>{summary.name}</Text>
                    <Text style={styles.muted}>
                      {summary.setCount} セット ・ {formatVolume(summary.totalVolume)}
                    </Text>
                  </View>
                  <View style={styles.bodyPartBarTrack}>
                    <View
                      style={[
                        styles.bodyPartBarFill,
                        {
                          width: `${ratio * 100}%`,
                          backgroundColor: bodyPartColor(summary.bodyPartId),
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <BodyLogSection bodyLogs={bodyLogs} onSave={onSaveBodyLog} />

      {workouts.length === 0 ? (
        <Text style={styles.muted}>
          完了した記録はまだありません。ワークアウトを完了すると、ここに履歴が並びます。
        </Text>
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
                      <View
                        style={[
                          styles.exerciseDot,
                          { backgroundColor: bodyPartColor(exercise?.primaryBodyPartId) },
                        ]}
                      />
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
