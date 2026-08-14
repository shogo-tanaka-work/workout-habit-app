import { Alert, Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { BodyPart, Exercise } from '../types/domain';
import { daysBetween, formatDate } from '../utils/datetime';
import { ExerciseSelectList } from './ExerciseSelectList';

// 記録タブの入口。「次に何をやるか」を選ぶことだけに使う。
//
// 種目の一覧そのものは ExerciseSelectList が持つ（過去記録の編集画面と共有）。
// ここが足すのは、記録中にだけ意味のある補足（今日もうやったか・前回いつやったか）と、
// ワークアウトを締める操作。
export function ExercisePicker({
  exercises,
  bodyParts,
  todaySetCountByExerciseId,
  lastPerformedByExerciseId,
  onSelect,
  onAddCustomExercise,
  onSaveTemplate,
  canSaveTemplate,
  onPause,
  onComplete,
}: {
  /** 使用頻度順に並んだ、アーカイブされていない種目。 */
  exercises: Exercise[];
  bodyParts: BodyPart[];
  todaySetCountByExerciseId: Map<string, number>;
  lastPerformedByExerciseId: Map<string, string>;
  onSelect: (exercise: Exercise) => void;
  onAddCustomExercise: (name: string, bodyPartId: string) => void;
  onSaveTemplate: (name: string) => void;
  canSaveTemplate: boolean;
  onPause: () => void;
  onComplete: () => void;
}) {
  const today = formatDate(new Date());

  const promptSaveTemplate = () => {
    Alert.prompt('テンプレートとして保存', '今日の種目の並びを保存します。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '保存',
        onPress: (name?: string) => {
          if (name?.trim()) {
            onSaveTemplate(name);
          }
        },
      },
    ]);
  };

  // 行の右端に出す一言。今日やったかを最優先で、次に前回からの間隔を見せる。
  const describeExercise = (exercise: Exercise): string => {
    const todaySetCount = todaySetCountByExerciseId.get(exercise.id) ?? 0;
    if (todaySetCount > 0) {
      return `今日 ${todaySetCount} セット`;
    }
    const lastPerformedAt = lastPerformedByExerciseId.get(exercise.id);
    if (!lastPerformedAt) {
      return '未実施';
    }
    const days = daysBetween(lastPerformedAt, today);
    return days <= 0 ? '今日' : `${days} 日前`;
  };

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>種目を選択</Text>
        </View>

        <ExerciseSelectList
          exercises={exercises}
          bodyParts={bodyParts}
          onSelect={onSelect}
          onAddCustomExercise={onAddCustomExercise}
          describeExercise={describeExercise}
        />
      </View>

      {/* ワークアウトを締める操作は、種目を選び終えたあとに来るので一覧の下に置く。 */}
      <View style={styles.sectionBody}>
        {canSaveTemplate ? (
          <Pressable style={styles.ghostButton} onPress={promptSaveTemplate}>
            <Text style={styles.ghostButtonText}>今日の種目構成をテンプレートとして保存</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.ghostButton} onPress={onPause}>
          <Text style={styles.ghostButtonText}>一時保存して閉じる</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onComplete}>
          <Text style={styles.primaryButtonText}>今日のワークアウトを完了</Text>
        </Pressable>
      </View>
    </View>
  );
}
