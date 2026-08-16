import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

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
  // メモは1文字ごとに保存しない（打鍵のたびに DB 書き込みと再読込が走るため）。
  // 数値入力の draft + 確定パターンと同じく、シートを閉じるときにまとめて保存する。
  const [memoDraft, setMemoDraft] = useState(set.memo);

  // 別の変更と一緒に閉じるときは1回の patch にまとめる。2回に分けると、
  // どちらも閉じた時点の state から組み立てるため、先に送った変更が消える。
  const withMemoDraft = (patch: SetPatch): SetPatch =>
    memoDraft === set.memo ? patch : { ...patch, memo: memoDraft };

  const applyAndClose = (patch: SetPatch) => {
    onPatchSet(set.id, withMemoDraft(patch));
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

  const commitMemoAndClose = () => {
    if (memoDraft !== set.memo) {
      onPatchSet(set.id, { memo: memoDraft });
    }
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={commitMemoAndClose}>
      <Pressable style={styles.modalBackdrop} onPress={commitMemoAndClose}>
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
            value={memoDraft}
            onChangeText={setMemoDraft}
            placeholder="このセットのメモ"
            placeholderTextColor={colors.textFaint}
            style={styles.memoInput}
          />

          <View style={styles.modalActions}>
            {/* 記録中は打ち間違いの消し直しが多いので確認を挟まない。
                過去の記録を直すときだけ confirmDelete で一拍置く。 */}
            <Pressable style={styles.deleteButton} onPress={requestDelete}>
              <Text style={styles.deleteButtonText}>削除</Text>
            </Pressable>
            <Pressable style={styles.primaryButtonFlat} onPress={commitMemoAndClose}>
              <Text style={styles.primaryButtonText}>閉じる</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
