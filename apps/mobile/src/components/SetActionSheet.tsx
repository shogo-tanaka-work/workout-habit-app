import { Alert, Modal, Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { SetPatch, WorkoutSet } from '../types/domain';
import { nowIso } from '../utils/datetime';

// セット番号をタップしたときの操作シート。
//
// 表に並べるとボタンだらけになる操作（コピー・削除）をここへ集める。
// **ウォームアップは表の WU 行で直接切り替える**（シートの中にあると気づけなかった）。
// メモは種目単位へ移したので、ここでは扱わない（ExerciseLogSection のメモ欄）。
export function SetActionSheet({
  set,
  setNumber,
  previousSet,
  previousSessionSet,
  confirmDelete = false,
  onPatchSet,
  onClose,
}: {
  set: WorkoutSet;
  setNumber: number;
  /** 同じ種目の1つ前のセット。無ければ null。 */
  previousSet: WorkoutSet | null;
  /** 前回この種目をやったときの、同じ番号のセット。無ければ null。 */
  previousSessionSet: WorkoutSet | null;
  /** 削除の前に確認を挟むか。過去の記録を直すときだけ true にする。 */
  confirmDelete?: boolean;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onClose: () => void;
}) {
  const applyAndClose = (patch: SetPatch) => {
    onPatchSet(set.id, patch);
    onClose();
  };

  // 過去の記録は消えると取り返しがつかない。まず一拍置く（記録中は即削除）。
  const requestDelete = () => {
    if (!confirmDelete) {
      applyAndClose({ deletedAt: nowIso() });
      return;
    }
    Alert.alert(
      `セット ${setNumber} を削除`,
      `${set.weightKg}kg × ${set.reps} 回 の記録を削除します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => applyAndClose({ deletedAt: nowIso() }),
        },
      ],
    );
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

          <View style={styles.modalActions}>
            {/* 記録中は打ち間違いの消し直しが多いので確認を挟まない。
                過去の記録を直すときだけ confirmDelete で一拍置く。 */}
            <Pressable style={styles.deleteButton} onPress={requestDelete}>
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
