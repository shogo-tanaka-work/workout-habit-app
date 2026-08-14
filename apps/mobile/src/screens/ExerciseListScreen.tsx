import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { BodyPartPicker } from '../components/BodyPartPicker';
import { styles } from '../styles/appStyles';
import { bodyPartColor, colors } from '../styles/theme';
import type { BodyPart, Exercise } from '../types/domain';
import { formatTimer } from '../utils/format';

// 種目マスタの管理。設定タブ →「トレーニング種目」から開く。
//
// 行の見た目と絞り込みは記録タブの種目選択（ExercisePicker）に合わせている。
// 同じ「種目を探す」操作なのに画面ごとに作りが違うと、その都度読み方を覚え直すことになる。
export function ExerciseListScreen({
  exercises,
  bodyParts,
  bodyPartById,
  newExerciseName,
  onChangeNewExerciseName,
  onAddCustomExercise,
  onEditExercise,
  onSelectExercise,
}: {
  /** アーカイブ済みも含む全種目。 */
  exercises: Exercise[];
  bodyParts: BodyPart[];
  bodyPartById: Map<string, BodyPart>;
  newExerciseName: string;
  onChangeNewExerciseName: (value: string) => void;
  onAddCustomExercise: (bodyPartId: string) => void;
  onEditExercise: (exerciseId: string) => void;
  onSelectExercise: (exerciseId: string) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [filterBodyPartId, setFilterBodyPartId] = useState<string | null>(null);
  // 追加フォームは畳んでおく。ふだんは一覧を見る画面なので、常時開いていると邪魔になる。
  const [isAdding, setIsAdding] = useState(false);
  const [newBodyPartId, setNewBodyPartId] = useState(bodyParts[0]?.id ?? '');

  const normalizedKeyword = keyword.trim().toLowerCase();
  const listedExercises = exercises
    .filter((exercise) => !exercise.isArchived)
    .filter(
      (exercise) =>
        (filterBodyPartId === null || exercise.primaryBodyPartId === filterBodyPartId) &&
        (normalizedKeyword === '' || exercise.name.toLowerCase().includes(normalizedKeyword)),
    );
  const archivedExercises = exercises.filter((exercise) => exercise.isArchived);

  const handleAdd = () => {
    onAddCustomExercise(newBodyPartId);
    setIsAdding(false);
  };

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>トレーニング種目</Text>
          <Text style={styles.faint}>{listedExercises.length} 件</Text>
        </View>

        <View style={styles.sectionBody}>
          <TextInput
            value={keyword}
            onChangeText={setKeyword}
            placeholder="種目名で絞り込む"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
          />
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
              すべて
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

        {listedExercises.length === 0 ? (
          <View style={styles.sectionBody}>
            <Text style={styles.muted}>条件に合う種目がありません。</Text>
          </View>
        ) : null}

        {listedExercises.map((exercise) => (
          <ExerciseRow
            key={exercise.id}
            exercise={exercise}
            bodyPartName={bodyPartById.get(exercise.primaryBodyPartId)?.name ?? '未分類'}
            onSelect={() => onSelectExercise(exercise.id)}
            onEdit={() => onEditExercise(exercise.id)}
          />
        ))}

        <View style={styles.sectionBody}>
          {isAdding ? (
            <>
              <TextInput
                value={newExerciseName}
                onChangeText={onChangeNewExerciseName}
                placeholder="例: インクラインダンベルプレス"
                placeholderTextColor={colors.textFaint}
                autoFocus
                style={styles.textInput}
              />
              <Text style={styles.inputLabel}>部位</Text>
              <BodyPartPicker
                bodyParts={bodyParts}
                selectedId={newBodyPartId}
                onSelect={setNewBodyPartId}
              />
              <View style={styles.modalActions}>
                <Pressable style={styles.ghostButton} onPress={() => setIsAdding(false)}>
                  <Text style={styles.ghostButtonText}>キャンセル</Text>
                </Pressable>
                <Pressable style={styles.primaryButtonFlat} onPress={handleAdd}>
                  <Text style={styles.primaryButtonText}>登録</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable style={styles.primaryButton} onPress={() => setIsAdding(true)}>
              <Text style={styles.primaryButtonText}>＋ 種目を追加</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* アーカイブ済み。読み込み対象に含めているので、ここから戻せる。 */}
      {archivedExercises.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>アーカイブ済み</Text>
            <Text style={styles.faint}>{archivedExercises.length} 件</Text>
          </View>
          {archivedExercises.map((exercise) => (
            <Pressable
              key={exercise.id}
              style={styles.exerciseRow}
              onPress={() => onEditExercise(exercise.id)}
            >
              <View style={styles.exercisePickerRow}>
                <View style={styles.exerciseDot} />
                <Text style={styles.exercisePickerName}>{exercise.name}</Text>
                <Text style={styles.muted}>選択肢に出ません</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// 行タップで種目詳細（記録の推移）、右端の「編集」で設定モーダル。
function ExerciseRow({
  exercise,
  bodyPartName,
  onSelect,
  onEdit,
}: {
  exercise: Exercise;
  bodyPartName: string;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <Pressable style={styles.exerciseRow} onPress={onSelect}>
      <View style={styles.exercisePickerRow}>
        <View
          style={[
            styles.exerciseDot,
            { backgroundColor: bodyPartColor(exercise.primaryBodyPartId) },
          ]}
        />
        <View style={styles.flex}>
          <Text style={styles.exercisePickerName}>{exercise.name}</Text>
          <Text style={styles.faint}>
            {bodyPartName} ・ 休憩 {formatTimer(exercise.defaultRestSeconds)} ・ バー{' '}
            {exercise.defaultBarWeightKg} kg
          </Text>
        </View>
        <Pressable style={styles.smallButton} onPress={onEdit}>
          <Text style={styles.smallButtonText}>編集</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
