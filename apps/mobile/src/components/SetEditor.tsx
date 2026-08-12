import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';
import { nowIso } from '../utils/datetime';
import { estimateOneRepMax } from '../utils/number';
import { rmDivisorFor } from '../utils/oneRepMax';
import { LabeledNumber } from './LabeledNumber';

// 1セットの編集行。
//
// RPE は入力欄に出さない。列とデータは残しているが、実績は全行 0 で使われておらず、
// トレーニング中の一等地を使わない値に割いていた（重量と回数だけが常に要る）。
//
// 完了はタイマーと切り離す。「完了＋タイマー」しか無かったころは、
// タイマーが要らないときに完了を付けられず、履歴の編集画面では操作すらできなかった。

export function SetEditor({
  set,
  setNumber,
  workoutExercise,
  onPatchSet,
  onStartRestTimer,
  showTimer,
}: {
  set: WorkoutSet;
  // 表示上の連番（削除を除いた並び順）。orderIndex は欠番が出るため使わない。
  setNumber: number;
  workoutExercise: WorkoutExercise;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  showTimer: boolean;
}) {
  // 記録は消えると取り返しがつかない。まず一拍置く。
  const confirmDelete = () => {
    Alert.alert(
      `セット ${setNumber} を削除`,
      `${set.weightKg}kg × ${set.reps} 回 の記録を削除します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => onPatchSet(set.id, { deletedAt: nowIso() }),
        },
      ],
    );
  };

  return (
    <View style={styles.setEditor}>
      <View style={styles.rowBetween}>
        <Text style={[styles.setTitle, set.isCompleted && styles.completedSetTitle]}>
          セット {setNumber}
          {set.isCompleted ? ' ✓' : ''}
        </Text>
        <View style={styles.setActions}>
          <Pressable
            style={[styles.pill, set.isCompleted && styles.activePill]}
            onPress={() => onPatchSet(set.id, { isCompleted: !set.isCompleted })}
          >
            <Text style={[styles.pillText, set.isCompleted && styles.activePillText]}>完了</Text>
          </Pressable>
          <Pressable
            style={[styles.pill, set.isWarmup && styles.activePill]}
            onPress={() => onPatchSet(set.id, { isWarmup: !set.isWarmup })}
          >
            <Text style={[styles.pillText, set.isWarmup && styles.activePillText]}>WU</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={confirmDelete}>
            <Text style={styles.deleteButtonText}>削除</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.inputGrid}>
        <LabeledNumber
          label="重量"
          value={set.weightKg}
          suffix="kg"
          onChange={(value) => onPatchSet(set.id, { weightKg: value })}
        />
        <LabeledNumber
          label="回数"
          value={set.reps}
          suffix="回"
          onChange={(value) => onPatchSet(set.id, { reps: Math.max(0, Math.round(value)) })}
        />
      </View>
      <TextInput
        value={set.memo}
        onChangeText={(memo) => onPatchSet(set.id, { memo })}
        placeholder="メモ"
        placeholderTextColor={colors.textFaint}
        style={styles.memoInput}
      />
      <View style={styles.rowBetween}>
        <Text style={styles.muted}>
          {set.isWarmup
            ? 'ウォームアップ（集計に入りません）'
            : `推定1RM ${estimateOneRepMax(set.weightKg, set.reps, rmDivisorFor(workoutExercise.exerciseId))} kg`}
        </Text>
        {showTimer ? (
          <Pressable
            style={[styles.timerButton, set.isCompleted && styles.doneButton]}
            onPress={() => onStartRestTimer(set, workoutExercise)}
          >
            <Text style={styles.timerButtonText}>
              {set.isCompleted ? '再タイマー' : '完了＋タイマー'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
