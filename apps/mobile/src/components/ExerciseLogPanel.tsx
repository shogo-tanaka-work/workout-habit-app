import { Pressable, Text, View } from 'react-native';

import { ExerciseLogSection } from './ExerciseLogSection';
import { RecentSessions } from './RecentSessions';
import { styles } from '../styles/appStyles';
import type { Exercise, SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';

// いま実施している1種目だけを見せる記録画面。
//
// ここに今日の全種目を並べない。「今やっている種目」しか見ないので、
// 一日の全体像はホームのカレンダーと履歴タブが受け持つ。
//
// セットの入力そのものは ExerciseLogSection が持つ（過去の記録の編集画面と共有）。
// ここが足すのは、記録タブにだけ要る戻る導線と前回実績。
export function ExerciseLogPanel({
  workoutExercise,
  exercise,
  visibleSets,
  recentSessions,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
  onBack,
}: {
  workoutExercise: WorkoutExercise;
  exercise: Exercise | undefined;
  /** 削除されていないセット全体。この種目のぶんは ExerciseLogSection が絞る。 */
  visibleSets: WorkoutSet[];
  /** 直近の実施記録（新しい順）。 */
  recentSessions: ExerciseSession[];
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.stack}>
      <Pressable style={styles.backRow} onPress={onBack}>
        <Text style={styles.headerBackText}>‹</Text>
        <Text style={styles.backRowText}>種目を選ぶ</Text>
      </Pressable>

      <ExerciseLogSection
        workoutExercise={workoutExercise}
        exercise={exercise}
        visibleSets={visibleSets}
        recentSessions={recentSessions}
        onAddSet={onAddSet}
        onPatchSet={onPatchSet}
        onStartRestTimer={onStartRestTimer}
        onOpenRestPicker={onOpenRestPicker}
      />

      <RecentSessions sessions={recentSessions} exerciseId={exercise?.id} />
    </View>
  );
}
