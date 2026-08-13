import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ExerciseLogPanel } from '../components/ExerciseLogPanel';
import { ExercisePicker } from '../components/ExercisePicker';
import { styles } from '../styles/appStyles';
import type {
  BodyPart,
  Exercise,
  SetPatch,
  Template,
  TemplateExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';
import { exerciseNameOf } from '../utils/workoutTree';
import { restSecondsFor } from '../utils/restPresets';

// 記録タブは2段構え。「種目を選ぶ」→「その種目だけ記録する」。
//
// 今日やった全種目を1画面に積み上げない。実施中に見たいのは今の種目だけで、
// 一日の全体像はホームのカレンダー、過去の編集は履歴タブが受け持つ。
export function WorkoutScreen({
  activeWorkout,
  workoutExercises,
  visibleSets,
  exercises,
  exerciseById,
  bodyParts,
  recentSessionsByExerciseId,
  lastPerformedByExerciseId,
  templates,
  templateExercises,
  onStart,
  onStartFromTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onComplete,
  onPause,
  onAddExercise,
  onAddCustomExercise,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
}: {
  activeWorkout: Workout | null;
  /** 記録中のワークアウトに入っている種目。 */
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exercises: Exercise[];
  exerciseById: Map<string, Exercise>;
  bodyParts: BodyPart[];
  /** 種目IDごとの、直近の実施記録（新しい順）。 */
  recentSessionsByExerciseId: Map<string, ExerciseSession[]>;
  /** 種目IDごとの、直近で実施した日（ISO 日付）。 */
  lastPerformedByExerciseId: Map<string, string>;
  templates: Template[];
  templateExercises: TemplateExercise[];
  onStart: () => void;
  onStartFromTemplate: (template: Template) => void;
  onSaveTemplate: (name: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onComplete: () => void;
  onPause: () => void;
  /** 追加できたら true。失敗の報告は呼び出し側が済ませている。 */
  onAddExercise: (exercise: Exercise) => Promise<boolean>;
  onAddCustomExercise: (name: string, bodyPartId: string) => void;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
}) {
  // 記録中の種目。workoutExercise の ID ではなく種目 ID で持つ。
  // 追加直後は workoutExercise がまだ手元に無く、再読み込み後に解決するため。
  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);

  const focused = focusedExerciseId
    ? (workoutExercises.find((item) => item.exerciseId === focusedExerciseId) ?? null)
    : null;

  // memo した SetLogTable が効くよう、セット表へ渡す配列は元データが変わったときだけ作り直す。
  const focusedSets = useMemo(() => {
    if (!focused) {
      return [];
    }
    return visibleSets
      .filter((set) => set.workoutExerciseId === focused.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [focused, visibleSets]);

  const todaySetCountByExerciseId = useMemo(() => {
    const countByExerciseId = new Map<string, number>();
    for (const item of workoutExercises) {
      const count = visibleSets.filter((set) => set.workoutExerciseId === item.id).length;
      countByExerciseId.set(item.exerciseId, (countByExerciseId.get(item.exerciseId) ?? 0) + count);
    }
    return countByExerciseId;
  }, [workoutExercises, visibleSets]);

  // テンプレートからの開始は、記録中でないときだけ（ワークアウトは同時に1つ）。
  const confirmDeleteTemplate = (template: Template) => {
    Alert.alert('テンプレートを削除', `「${template.name}」を削除します。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDeleteTemplate(template.id) },
    ]);
  };

  if (!activeWorkout) {
    return (
      <View style={styles.stack}>
        <View style={styles.section}>
          <View style={styles.sectionBody}>
            <Text style={styles.sectionTitle}>記録中のワークアウトはありません</Text>
            <Text style={styles.muted}>まず今日のワークアウトを開始しましょう。</Text>
            <Pressable style={styles.primaryButton} onPress={onStart}>
              <Text style={styles.primaryButtonText}>ワークアウト開始</Text>
            </Pressable>
          </View>
        </View>

        {templates.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>テンプレートから開始</Text>
            </View>
            {templates.map((template) => {
              const exerciseNames = templateExercises
                .filter((item) => item.templateId === template.id)
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item) => exerciseNameOf(item.exerciseId, exerciseById));
              return (
                <View key={template.id} style={styles.exerciseRow}>
                  <Pressable
                    style={styles.exerciseRowHeader}
                    onPress={() => onStartFromTemplate(template)}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.exerciseRowName}>{template.name}</Text>
                      <Text style={styles.faint}>{exerciseNames.join(' ・ ')}</Text>
                    </View>
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => confirmDeleteTemplate(template)}
                    >
                      <Text style={styles.deleteButtonText}>削除</Text>
                    </Pressable>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }

  if (focused) {
    const exercise = exerciseById.get(focused.exerciseId);
    return (
      <ExerciseLogPanel
        workoutExercise={focused}
        exercise={exercise}
        sets={focusedSets}
        recentSessions={recentSessionsByExerciseId.get(focused.exerciseId) ?? []}
        restSeconds={restSecondsFor(focused, exercise)}
        onAddSet={onAddSet}
        onPatchSet={onPatchSet}
        onStartRestTimer={onStartRestTimer}
        onOpenRestPicker={onOpenRestPicker}
        onBack={() => setFocusedExerciseId(null)}
      />
    );
  }

  // 未追加の種目はワークアウトへ入れてから開く。追加済みならそのまま開く。
  // **追加に失敗したら開かない。** 開いてしまうと、記録できない種目のパネルを操作させることになる。
  const handleSelect = async (exercise: Exercise) => {
    const alreadyAdded = workoutExercises.some((item) => item.exerciseId === exercise.id);
    if (!alreadyAdded) {
      const added = await onAddExercise(exercise);
      if (!added) {
        return;
      }
    }
    setFocusedExerciseId(exercise.id);
  };

  return (
    <ExercisePicker
      exercises={exercises}
      bodyParts={bodyParts}
      todaySetCountByExerciseId={todaySetCountByExerciseId}
      lastPerformedByExerciseId={lastPerformedByExerciseId}
      onSelect={(exercise) => void handleSelect(exercise)}
      onAddCustomExercise={onAddCustomExercise}
      onSaveTemplate={onSaveTemplate}
      canSaveTemplate={workoutExercises.length > 0}
      onPause={onPause}
      onComplete={onComplete}
    />
  );
}
