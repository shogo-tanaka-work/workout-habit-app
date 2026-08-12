import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { isCustomExerciseId } from '../db/syncTables';
import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { BodyPart, Exercise } from '../types/domain';
import { formatTimer } from '../utils/format';
import { BodyPartPicker } from './BodyPartPicker';
import { LabeledNumber } from './LabeledNumber';

// 種目の設定を編集する。
//
// **プリセット種目は名前と部位を変えられない。** 全ユーザー共有の行で、
// 変えられると同じ ID が人によって別の種目を指すことになる。入力を無効にして理由を書く。
//
// バー重量・休憩・非表示は上書きできる（`user_exercise_settings`）。
// バーの重さはジムによって違い、28件のプリセットには使わないものも混じるため。
//
// 休憩はここでも変えられる。種目の設定を1か所に集めるため、よく使う値の
// チップで選ぶ形にしている（記録中の細かい調整は休憩ピッカーが受け持つ）。

// 種目ごとの既定休憩に選べる値（秒）。ジムで実際に使う範囲に絞る。
const REST_CHOICES = [30, 60, 90, 120, 150, 180, 240, 300] as const;

export function ExerciseEditModal({
  exercise,
  bodyParts,
  onSave,
  onCancel,
}: {
  exercise: Exercise;
  bodyParts: BodyPart[];
  onSave: (next: Exercise) => void;
  onCancel: () => void;
}) {
  // 名前と部位を変えられるのはカスタム種目だけ。バー重量と非表示は共通で変えられる。
  const isCustom = isCustomExerciseId(exercise.id);
  const [name, setName] = useState(exercise.name);
  const [bodyPartId, setBodyPartId] = useState(exercise.primaryBodyPartId);
  const [barWeightKg, setBarWeightKg] = useState(exercise.defaultBarWeightKg);
  const [restSeconds, setRestSeconds] = useState(exercise.defaultRestSeconds);
  const [isArchived, setIsArchived] = useState(exercise.isArchived);

  const canSave = name.trim().length > 0;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.sectionTitle}>種目の設定</Text>
          {isCustom ? (
            <Text style={styles.muted}>この種目はあなたが追加したものです。</Text>
          ) : (
            <Text style={styles.accentNote}>
              共有プリセットです。名前と部位は変えられませんが、
              バー重量と表示・非表示はあなたの設定として保存されます。
            </Text>
          )}

          <Text style={styles.inputLabel}>名前</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={isCustom}
            placeholderTextColor={colors.textFaint}
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>部位</Text>
          <BodyPartPicker
            bodyParts={bodyParts}
            selectedId={bodyPartId}
            onSelect={setBodyPartId}
            disabled={!isCustom}
          />

          <LabeledNumber
            label="バー重量"
            value={barWeightKg}
            suffix="kg"
            onChange={setBarWeightKg}
          />
          <Text style={styles.inputLabel}>休憩</Text>
          <View style={styles.chipWrap}>
            {REST_CHOICES.map((seconds) => {
              const isActive = seconds === restSeconds;
              return (
                <Pressable
                  key={seconds}
                  style={[styles.choiceChip, isActive && styles.activePill]}
                  onPress={() => setRestSeconds(seconds)}
                >
                  <Text style={[styles.choiceChipText, isActive && styles.activePillText]}>
                    {formatTimer(seconds)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* アーカイブは削除の代わり。記録が種目を参照しているため消せない。 */}
          <Pressable
            style={[styles.choiceChip, styles.choiceChipWide, isArchived && styles.activePill]}
            onPress={() => setIsArchived((current) => !current)}
          >
            <Text style={[styles.choiceChipText, isArchived && styles.activePillText]}>
              {isArchived ? 'アーカイブ中（選択肢に出ません）' : 'アーカイブする'}
            </Text>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable style={[styles.ghostButton, styles.flex]} onPress={onCancel}>
              <Text style={styles.ghostButtonText}>キャンセル</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, styles.flex, !canSave && styles.disabledPill]}
              disabled={!canSave}
              onPress={() =>
                onSave({
                  ...exercise,
                  name: name.trim(),
                  primaryBodyPartId: bodyPartId,
                  defaultBarWeightKg: barWeightKg,
                  defaultRestSeconds: restSeconds,
                  isArchived,
                })
              }
            >
              <Text style={styles.secondaryButtonText}>保存</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
