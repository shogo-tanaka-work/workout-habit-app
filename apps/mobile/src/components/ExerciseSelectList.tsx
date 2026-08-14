import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { BodyPart, Exercise } from '../types/domain';

// 種目を選ぶ一覧（部位タブ＋種目行＋その部位への種目追加）。
//
// **選ぶことだけを受け持つ。** 記録タブの「完了」「一時保存」や、編集画面の開閉のような
// 画面ごとの操作は呼び出し側に置く。セクションの箱とヘッダーも呼び出し側が用意する。
export function ExerciseSelectList({
  exercises,
  bodyParts,
  onSelect,
  onAddCustomExercise,
  describeExercise,
}: {
  /** 使用頻度順に並んだ、アーカイブされていない種目。 */
  exercises: Exercise[];
  bodyParts: BodyPart[];
  onSelect: (exercise: Exercise) => void;
  onAddCustomExercise: (name: string, bodyPartId: string) => void;
  /** 行の右端に出す一言。要らない画面では省略する。 */
  describeExercise?: (exercise: Exercise) => string;
}) {
  // 既定は先頭の部位（胸）。「よく使う」を初期表示にすると、
  // 種目が増えるほど目的の種目が下へ流れて探しづらい。
  const [filterBodyPartId, setFilterBodyPartId] = useState<string | null>(
    () => bodyParts[0]?.id ?? null,
  );

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

  return (
    <>
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
              <View style={[styles.bodyPartTabDot, { backgroundColor: bodyPartColor(part.id) }]} />
              <Text style={[styles.bodyPartTabText, isActive && styles.activePillText]}>
                {part.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {visibleExercises.map((exercise) => (
        <Pressable key={exercise.id} style={styles.exerciseRow} onPress={() => onSelect(exercise)}>
          <View style={styles.exercisePickerRow}>
            <View
              style={[
                styles.exerciseDot,
                { backgroundColor: bodyPartColor(exercise.primaryBodyPartId) },
              ]}
            />
            <Text style={styles.exercisePickerName}>{exercise.name}</Text>
            {describeExercise ? (
              <Text style={styles.muted}>{describeExercise(exercise)}</Text>
            ) : null}
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
            <Text style={styles.secondaryButtonText}>＋ 「{filterBodyPart.name}」に種目を追加</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}
