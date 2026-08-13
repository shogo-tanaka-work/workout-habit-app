import { Alert, Pressable, Text, View } from 'react-native';

import { StatSummary } from '../components/StatSummary';
import { WorkoutExerciseList } from '../components/WorkoutExerciseList';
import { styles } from '../styles/appStyles';
import type { Exercise, SetPatch, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { summarizeSets } from '../utils/aggregate';
import { formatCount } from '../utils/number';

// 過去の記録を直す画面。ホームのカレンダーで日を選び、「編集」から入る。
//
// 履歴タブには置かない。履歴は期間の集計を見る場所で、日単位の記録はホームが持つ。
export function WorkoutEditScreen({
  workout,
  workoutExercises,
  visibleSets,
  exerciseById,
  onAddSet,
  onPatchSet,
  onDeleteWorkout,
}: {
  workout: Workout;
  /** この記録に入っている種目（表示順）。 */
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onDeleteWorkout: (workoutId: string) => void;
}) {
  const itemIds = new Set(workoutExercises.map((item) => item.id));
  const workoutSets = visibleSets.filter((set) => itemIds.has(set.workoutExerciseId));
  const summary = summarizeSets(workoutSets);

  // 1日ぶんの記録がまとめて消える。ここは確認を挟む。
  const confirmDelete = () => {
    Alert.alert('記録を削除', `${workout.performedAt} の記録を削除します。元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDeleteWorkout(workout.id) },
    ]);
  };

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <StatSummary
          primary={{ label: '総ボリューム', value: formatCount(summary.totalVolume), unit: 'kg' }}
          items={[
            { label: '種目', value: formatCount(workoutExercises.length) },
            { label: 'セット', value: formatCount(summary.setCount) },
            { label: 'レップ', value: formatCount(summary.totalReps) },
          ]}
        />
      </View>

      {workoutExercises.length === 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionBody}>
            <Text style={styles.muted}>この記録に種目が入っていません。</Text>
          </View>
        </View>
      ) : null}

      <WorkoutExerciseList
        workoutExercises={workoutExercises}
        visibleSets={visibleSets}
        exerciseById={exerciseById}
        onAddSet={onAddSet}
        onPatchSet={onPatchSet}
      />

      <View style={styles.section}>
        <View style={styles.sectionBody}>
          <Pressable style={styles.dangerButton} onPress={confirmDelete}>
            <Text style={styles.dangerButtonText}>この記録を削除</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
