import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RecentSessions } from './RecentSessions';
import { SetActionSheet } from './SetActionSheet';
import { SetLogTable } from './SetLogTable';
import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { Exercise, SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';
import { summarizeSets } from '../utils/aggregate';
import { formatTimer } from '../utils/format';
import { rmDivisorFor } from '../utils/oneRepMax';
import { formatVolume, formatWeight } from '../utils/number';

// いま実施している1種目だけを見せる記録画面。
//
// ここに今日の全種目を並べない。「今やっている種目」しか見ないので、
// 一日の全体像はホームのカレンダーと履歴タブが受け持つ。
export function ExerciseLogPanel({
  workoutExercise,
  exercise,
  sets,
  recentSessions,
  restSeconds,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
  onBack,
}: {
  workoutExercise: WorkoutExercise;
  exercise: Exercise | undefined;
  /** 表示順に並んだ、削除されていないセット。 */
  sets: WorkoutSet[];
  /** 直近の実施記録（新しい順）。 */
  recentSessions: ExerciseSession[];
  restSeconds: number;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  onBack: () => void;
}) {
  const [actionTarget, setActionTarget] = useState<{ set: WorkoutSet; setNumber: number } | null>(
    null,
  );
  const summary = summarizeSets(sets, rmDivisorFor(exercise?.id));

  // 完了を付けると、そのまま休憩に入る（beginRestTimer が完了も立てる）。
  // ボタンを2つ置かず、ジムでの一手を減らすため。止めたいときはタイマーバナーから止める。
  // memo した SetLogTable へ渡すため、useCallback で参照を安定させる。
  const handlePatchSet = useCallback(
    (setId: string, patch: SetPatch) => {
      if (patch.isCompleted === true) {
        const target = sets.find((set) => set.id === setId);
        if (target) {
          onStartRestTimer(target, workoutExercise);
          return;
        }
      }
      onPatchSet(setId, patch);
    },
    [sets, onStartRestTimer, workoutExercise, onPatchSet],
  );

  const handleOpenSetActions = useCallback((set: WorkoutSet, setNumber: number) => {
    setActionTarget({ set, setNumber });
  }, []);

  const actionSetIndex = actionTarget
    ? sets.findIndex((set) => set.id === actionTarget.set.id)
    : -1;
  const previousSet = actionSetIndex > 0 ? (sets[actionSetIndex - 1] ?? null) : null;
  const previousSessionSet = actionTarget
    ? (recentSessions[0]?.sets[actionTarget.setNumber - 1] ?? null)
    : null;

  return (
    <View style={styles.stack}>
      <Pressable style={styles.backRow} onPress={onBack}>
        <Text style={styles.headerBackText}>‹</Text>
        <Text style={styles.backRowText}>種目を選ぶ</Text>
      </Pressable>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.inlineRow}>
            <View
              style={[
                styles.exerciseDot,
                { backgroundColor: bodyPartColor(exercise?.primaryBodyPartId) },
              ]}
            />
            <View>
              <Text style={styles.logExerciseName}>{exercise?.name ?? '種目'}</Text>
              <Text style={styles.logExerciseSummary}>
                {summary.setCount} セット
                {summary.warmupCount > 0 ? `（＋WU ${summary.warmupCount}）` : ''} ・{' '}
                {formatVolume(summary.totalVolume)} ・ 推定1RM {formatWeight(summary.bestOneRepMax)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionBody}>
          <Pressable
            style={styles.restRow}
            onPress={() => exercise && onOpenRestPicker(exercise.id, restSeconds)}
          >
            <Text style={styles.restLabel}>休憩タイマー</Text>
            <Text style={styles.restValue}>{formatTimer(restSeconds)} ›</Text>
          </Pressable>
        </View>

        <SetLogTable
          sets={sets}
          onPatchSet={handlePatchSet}
          onOpenSetActions={handleOpenSetActions}
        />

        <View style={styles.sectionBody}>
          <Pressable style={styles.primaryButton} onPress={() => onAddSet(workoutExercise)}>
            <Text style={styles.primaryButtonText}>＋ セット</Text>
          </Pressable>
        </View>
      </View>

      <RecentSessions sessions={recentSessions} />

      {actionTarget ? (
        <SetActionSheet
          set={sets.find((set) => set.id === actionTarget.set.id) ?? actionTarget.set}
          setNumber={actionTarget.setNumber}
          previousSet={previousSet}
          previousSessionSet={previousSessionSet}
          onPatchSet={onPatchSet}
          onClose={() => setActionTarget(null)}
        />
      ) : null}
    </View>
  );
}
