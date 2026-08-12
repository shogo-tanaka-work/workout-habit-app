import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { SetPatch, WorkoutSet } from '../types/domain';
import { nowIso } from '../utils/datetime';

// セット番号をタップしたときの操作シート。
// 行に並べるとボタンだらけになる操作（コピー・ウォームアップ・メモ・削除）をここへ集める。
export function SetActionSheet({
  set,
  setNumber,
  previousSet,
  previousSessionSet,
  onPatchSet,
  onClose,
}: {
  set: WorkoutSet;
  setNumber: number;
  /** 同じ種目の1つ前のセット。無ければ null。 */
  previousSet: WorkoutSet | null;
  /** 前回この種目をやったときの、同じ番号のセット。無ければ null。 */
  previousSessionSet: WorkoutSet | null;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onClose: () => void;
}) {
  const applyAndClose = (patch: SetPatch) => {
    onPatchSet(set.id, patch);
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.sectionTitle}>セット {setNumber}</Text>

          {previousSessionSet ? (
            <Pressable
              style={styles.sheetAction}
              onPress={() =>
                applyAndClose({
                  weightKg: previousSessionSet.weightKg,
                  reps: previousSessionSet.reps,
                })
              }
            >
              <Text style={styles.sheetActionText}>前回の記録をコピー</Text>
              <Text style={styles.muted}>
                {previousSessionSet.weightKg}kg × {previousSessionSet.reps} 回
              </Text>
            </Pressable>
          ) : null}

          {previousSet ? (
            <Pressable
              style={styles.sheetAction}
              onPress={() =>
                applyAndClose({ weightKg: previousSet.weightKg, reps: previousSet.reps })
              }
            >
              <Text style={styles.sheetActionText}>前のセットをコピー</Text>
              <Text style={styles.muted}>
                {previousSet.weightKg}kg × {previousSet.reps} 回
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.sheetAction}
            onPress={() => applyAndClose({ isWarmup: !set.isWarmup })}
          >
            <Text style={styles.sheetActionText}>
              {set.isWarmup ? 'ウォームアップを解除' : 'ウォームアップにする'}
            </Text>
            <Text style={styles.muted}>集計に入りません</Text>
          </Pressable>

          <TextInput
            value={set.memo}
            onChangeText={(memo) => onPatchSet(set.id, { memo })}
            placeholder="このセットのメモ"
            placeholderTextColor={colors.textFaint}
            style={styles.memoInput}
          />

          <View style={styles.modalActions}>
            {/* 記録中は打ち間違いの消し直しが多い。確認を挟まず即削除する
                （消えて困る過去の記録は履歴タブ側で確認を挟む）。 */}
            <Pressable
              style={styles.deleteButton}
              onPress={() => applyAndClose({ deletedAt: nowIso() })}
            >
              <Text style={styles.deleteButtonText}>削除</Text>
            </Pressable>
            <Pressable style={styles.primaryButtonFlat} onPress={onClose}>
              <Text style={styles.primaryButtonText}>閉じる</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
