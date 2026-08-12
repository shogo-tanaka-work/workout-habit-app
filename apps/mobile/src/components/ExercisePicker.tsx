import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { BodyPart, Exercise } from '../types/domain';
import { daysBetween, formatDate } from '../utils/datetime';

// 記録タブの入口。「次に何をやるか」を選ぶことだけに使う。
//
// 種目は使用頻度順で、部位タブと検索で絞る。行に出す補足は
// 「今日もうやったか」「前回いつやったか」の2つだけに絞っている。
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
  // 既定は先頭の部位（胸）。「よく使う」を初期表示にすると、
  // 種目が増えるほど目的の種目が下へ流れて探しづらい。
  const [filterBodyPartId, setFilterBodyPartId] = useState<string | null>(
    () => bodyParts[0]?.id ?? null,
  );

  const today = formatDate(new Date());
  const visibleExercises = exercises.filter(
    (exercise) => filterBodyPartId === null || exercise.primaryBodyPartId === filterBodyPartId,
  );
  const filterBodyPart = filterBodyPartId
    ? (bodyParts.find((part) => part.id === filterBodyPartId) ?? null)
    : null;

  // iOS 専用の Alert.prompt で名前を入力させる（このアプリは iOS を主対象とする）。
  const promptAddExercise = (bodyPart: BodyPart) => {
    Alert.prompt('種目を追加', `「${bodyPart.name}」の種目として追加します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '追加',
        onPress: (name?: string) => {
          if (name?.trim()) {
            onAddCustomExercise(name, bodyPart.id);
          }
        },
      },
    ]);
  };

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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bodyPartTabs}
        >
          <Pressable
            style={[styles.bodyPartTab, filterBodyPartId === null && styles.activePill]}
            onPress={() => setFilterBodyPartId(null)}
          >
            <Text
              style={[styles.bodyPartTabText, filterBodyPartId === null && styles.activePillText]}
            >
              よく使う
            </Text>
          </Pressable>
          {bodyParts.map((part) => {
            const isActive = filterBodyPartId === part.id;
            return (
              <Pressable
                key={part.id}
                style={[styles.bodyPartTab, isActive && styles.activePill]}
                onPress={() => setFilterBodyPartId(isActive ? null : part.id)}
              >
                <View
                  style={[styles.bodyPartTabDot, { backgroundColor: bodyPartColor(part.id) }]}
                />
                <Text style={[styles.bodyPartTabText, isActive && styles.activePillText]}>
                  {part.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visibleExercises.map((exercise) => (
          <Pressable
            key={exercise.id}
            style={styles.exerciseRow}
            onPress={() => onSelect(exercise)}
          >
            <View style={styles.exercisePickerRow}>
              <View
                style={[
                  styles.exerciseDot,
                  { backgroundColor: bodyPartColor(exercise.primaryBodyPartId) },
                ]}
              />
              <Text style={styles.exercisePickerName}>{exercise.name}</Text>
              <Text style={styles.muted}>{describeExercise(exercise)}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        ))}

        {visibleExercises.length === 0 ? (
          <View style={styles.sectionBody}>
            <Text style={styles.muted}>
              この部位の種目がまだありません。下のボタンから追加できます。
            </Text>
          </View>
        ) : null}

        {filterBodyPart ? (
          <View style={styles.sectionBody}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => promptAddExercise(filterBodyPart)}
            >
              <Text style={styles.secondaryButtonText}>
                ＋ 「{filterBodyPart.name}」に種目を追加
              </Text>
            </Pressable>
          </View>
        ) : null}
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
