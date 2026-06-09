import { Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';
import { nowIso } from '../utils/datetime';
import { estimateOneRepMax } from '../utils/number';
import { LabeledNumber } from './LabeledNumber';

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
  return (
    <View style={styles.setEditor}>
      <View style={styles.rowBetween}>
        <Text style={[styles.setTitle, set.isCompleted && styles.completedSetTitle]}>
          セット {setNumber}
          {set.isCompleted ? ' ✓' : ''}
        </Text>
        <View style={styles.setActions}>
          <Pressable
            style={[styles.pill, set.isWarmup && styles.activePill]}
            onPress={() => onPatchSet(set.id, { isWarmup: !set.isWarmup })}
          >
            <Text style={[styles.pillText, set.isWarmup && styles.activePillText]}>WU</Text>
          </Pressable>
          <Pressable
            style={styles.deleteButton}
            onPress={() => onPatchSet(set.id, { deletedAt: nowIso() })}
          >
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
        <LabeledNumber
          label="RPE"
          value={set.rpe}
          suffix=""
          onChange={(value) => onPatchSet(set.id, { rpe: value })}
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
        <Text style={styles.muted}>推定1RM {estimateOneRepMax(set.weightKg, set.reps)} kg</Text>
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
