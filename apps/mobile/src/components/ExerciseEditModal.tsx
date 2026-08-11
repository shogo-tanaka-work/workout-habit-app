import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { isCustomExerciseId } from '../db/syncTables';
import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { BodyPart, Exercise } from '../types/domain';
import { BodyPartPicker } from './BodyPartPicker';
import { LabeledNumber } from './LabeledNumber';

// 種目の設定を編集する。
//
// **プリセット種目は名前・部位・バー重量を変えられない。** 全ユーザー共有の行で、
// サーバが書き換えを拒む。ここで編集させると端末とサーバが静かに食い違うため、
// 入力自体を無効にして理由を書く。カスタム種目（`exercise-` 始まり）だけが編集できる。
//
// レスト時間はこのモーダルでは扱わない（既存の休憩ピッカーが受け持つ）。

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
  const isEditable = isCustomExerciseId(exercise.id);
  const [name, setName] = useState(exercise.name);
  const [bodyPartId, setBodyPartId] = useState(exercise.primaryBodyPartId);
  const [barWeightKg, setBarWeightKg] = useState(exercise.defaultBarWeightKg);
  const [isArchived, setIsArchived] = useState(exercise.isArchived);

  const canSave = isEditable && name.trim().length > 0;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.sectionTitle}>種目の設定</Text>
          {isEditable ? (
            <Text style={styles.muted}>この種目はあなたが追加したものです。</Text>
          ) : (
            <Text style={styles.accentNote}>
              共有プリセットのため編集できません。休憩時間は一覧から変えられます。
            </Text>
          )}

          <Text style={styles.inputLabel}>名前</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            editable={isEditable}
            placeholderTextColor={colors.textFaint}
            style={styles.textInput}
          />

          <Text style={styles.inputLabel}>部位</Text>
          <BodyPartPicker
            bodyParts={bodyParts}
            selectedId={bodyPartId}
            onSelect={setBodyPartId}
            disabled={!isEditable}
          />

          {isEditable ? (
            <>
              <LabeledNumber
                label="バー重量"
                value={barWeightKg}
                suffix="kg"
                onChange={setBarWeightKg}
              />
              {/* アーカイブは削除の代わり。記録は種目を参照しているため消せない。 */}
              <Pressable
                style={[styles.pill, isArchived && styles.activePill]}
                onPress={() => setIsArchived((current) => !current)}
              >
                <Text style={[styles.pillText, isArchived && styles.activePillText]}>
                  {isArchived ? 'アーカイブ中（選択肢に出ません）' : 'アーカイブする'}
                </Text>
              </Pressable>
            </>
          ) : null}

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
