import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ExerciseSelectList } from '../components/ExerciseSelectList';
import { StatSummary } from '../components/StatSummary';
import { WorkoutExerciseList } from '../components/WorkoutExerciseList';
import { styles } from '../styles/appStyles';
import type {
  BodyPart,
  Exercise,
  SetPatch,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import { summarizeSets } from '../utils/aggregate';
import { formatCount } from '../utils/number';
import { setsOfWorkoutExercises } from '../utils/workoutTree';

// 過去の記録を直す画面。ホームのカレンダーで日を選び、「編集」から入る。
//
// 履歴タブには置かない。履歴は期間の集計を見る場所で、日単位の記録はホームが持つ。
//
// 記録中（active）のワークアウトもここから直せる。休憩タイマーと前回実績は持たないので、
// 実施しながらの入力は記録タブ（ExerciseLogPanel）を使う。
export function WorkoutEditScreen({
  workout,
  workoutExercises,
  visibleSets,
  exercises,
  bodyParts,
  exerciseById,
  onAddExercise,
  onAddCustomExercise,
  onAddSet,
  onPatchSet,
  onDeleteWorkout,
}: {
  workout: Workout;
  /** この記録に入っている種目（表示順）。 */
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  /** 使用頻度順に並んだ、アーカイブされていない種目。 */
  exercises: Exercise[];
  bodyParts: BodyPart[];
  exerciseById: Map<string, Exercise>;
  onAddExercise: (exercise: Exercise) => void;
  onAddCustomExercise: (name: string, bodyPartId: string) => void;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onDeleteWorkout: (workoutId: string) => void;
}) {
  // 種目を選ぶ一覧は開いたときだけ出す。常に出すと、直したいセットが下へ流れる。
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const workoutSets = setsOfWorkoutExercises(workoutExercises, visibleSets);
  const summary = summarizeSets(workoutSets);
  const isRecording = workout.status === 'active';

  // 1日ぶんの記録がまとめて消える。ここは確認を挟む。
  const confirmDelete = () => {
    Alert.alert('記録を削除', `${workout.performedAt} の記録を削除します。元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDeleteWorkout(workout.id) },
    ]);
  };

  const handleSelectExercise = (exercise: Exercise) => {
    onAddExercise(exercise);
    setIsPickerOpen(false);
  };

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        {isRecording ? (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>記録中のワークアウト</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>記録中</Text>
            </View>
          </View>
        ) : null}
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
            <Text style={styles.muted}>
              この記録に種目が入っていません。下の「種目を追加」から入れられます。
            </Text>
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>種目を追加</Text>
          {isPickerOpen ? (
            <Pressable style={styles.ghostButton} onPress={() => setIsPickerOpen(false)}>
              <Text style={styles.ghostButtonText}>閉じる</Text>
            </Pressable>
          ) : null}
        </View>
        {isPickerOpen ? (
          <ExerciseSelectList
            exercises={exercises}
            bodyParts={bodyParts}
            onSelect={handleSelectExercise}
            onAddCustomExercise={onAddCustomExercise}
          />
        ) : (
          <View style={styles.sectionBody}>
            <Pressable style={styles.secondaryButton} onPress={() => setIsPickerOpen(true)}>
              <Text style={styles.secondaryButtonText}>＋ 種目を選ぶ</Text>
            </Pressable>
          </View>
        )}
      </View>

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
