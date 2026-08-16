import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SetActionSheet } from './SetActionSheet';
import { SetLogTable } from './SetLogTable';
import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { Exercise, SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';
import { summarizeSets } from '../utils/aggregate';
import { formatTimer } from '../utils/format';
import { formatVolume, formatWeight } from '../utils/number';
import { rmDivisorFor, showsOneRepMax } from '../utils/oneRepMax';
import { restSecondsFor } from '../utils/restPresets';

// 1種目ぶんの記録カード。**セットは列に並べる**（SetLogTable）。
//
// 記録タブ（ExerciseLogPanel）と過去の記録の編集（WorkoutExerciseList）が共有する。
// 分けていたころは編集側だけが刷新前の縦積み UI のまま取り残され、
// 同じ「セットを入れる」操作なのに入り口によって別物になっていた。
//
// 記録中にだけ意味のある機能（休憩タイマー・前回実績からのコピー）は、
// 対応する props が渡されたときにだけ出す。過去日の編集では出さない。

// memo している。休憩タイマーの毎秒の再レンダリングが App から降りてくるため、
// props が変わらない限り描き直さない。
export const ExerciseLogSection = memo(function ExerciseLogSection({
  workoutExercise,
  exercise,
  visibleSets,
  recentSessions = [],
  confirmSetDelete = false,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
}: {
  workoutExercise: WorkoutExercise;
  exercise: Exercise | undefined;
  /** 削除されていないセット全体。この種目のぶんはここから絞る。 */
  visibleSets: WorkoutSet[];
  /** 直近の実施記録（新しい順）。渡すと操作シートに「前回をコピー」が出る。 */
  recentSessions?: ExerciseSession[];
  /** セット削除で確認を挟むか。記録中は打ち間違いの消し直しが多いので挟まない。 */
  confirmSetDelete?: boolean;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  /** 渡すと「完了」のタップでそのまま休憩に入る。 */
  onStartRestTimer?: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  /** 渡すと休憩タイマーの行を出す。休憩の秒数はここで決めない（restSecondsFor が正）。 */
  onOpenRestPicker?: (exerciseId: string, seconds: number) => void;
}) {
  const restSeconds = restSecondsFor(workoutExercise, exercise);
  const [actionTarget, setActionTarget] = useState<{ set: WorkoutSet; setNumber: number } | null>(
    null,
  );

  const sets = useMemo(
    () =>
      visibleSets
        .filter((set) => set.workoutExerciseId === workoutExercise.id)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [visibleSets, workoutExercise.id],
  );
  // ウォームアップを除いた集計。規則は utils/aggregate.ts に集約している。
  const summary = useMemo(
    () => summarizeSets(sets, rmDivisorFor(workoutExercise.exerciseId)),
    [sets, workoutExercise.exerciseId],
  );

  // 完了を付けると、そのまま休憩に入る（beginRestTimer が完了も立てる）。
  // ボタンを2つ置かず、ジムでの一手を減らすため。止めたいときはタイマーバナーから止める。
  // memo した SetLogTable へ渡すため、useCallback で参照を安定させる。
  const handlePatchSet = useCallback(
    (setId: string, patch: SetPatch) => {
      if (patch.isCompleted === true && onStartRestTimer) {
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
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.inlineRow}>
          <View
            style={[
              styles.exerciseDot,
              { backgroundColor: bodyPartColor(exercise?.primaryBodyPartId) },
            ]}
          />
          <View style={styles.flex}>
            <Text style={styles.logExerciseName}>{exercise?.name ?? '種目'}</Text>
            <Text style={styles.logExerciseSummary}>
              {summary.setCount} セット
              {summary.warmupCount > 0 ? `（＋WU ${summary.warmupCount}）` : ''} ・{' '}
              {formatVolume(summary.totalVolume)}
              {showsOneRepMax(workoutExercise.exerciseId)
                ? ` ・ 推定1RM ${formatWeight(summary.bestOneRepMax)}`
                : ''}
            </Text>
          </View>
        </View>
      </View>

      {onOpenRestPicker ? (
        <View style={styles.sectionBody}>
          <Pressable
            style={styles.restRow}
            onPress={() => exercise && onOpenRestPicker(exercise.id, restSeconds)}
          >
            <Text style={styles.restLabel}>休憩タイマー</Text>
            <Text style={styles.restValue}>{formatTimer(restSeconds)} ›</Text>
          </Pressable>
        </View>
      ) : null}

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

      {actionTarget ? (
        <SetActionSheet
          set={sets.find((set) => set.id === actionTarget.set.id) ?? actionTarget.set}
          setNumber={actionTarget.setNumber}
          previousSet={previousSet}
          previousSessionSet={previousSessionSet}
          confirmDelete={confirmSetDelete}
          onPatchSet={onPatchSet}
          onClose={() => setActionTarget(null)}
        />
      ) : null}
    </View>
  );
});
