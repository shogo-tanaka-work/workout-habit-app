import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { Exercise, SetPatch, WorkoutExercise, WorkoutSet } from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';
import { formatSetsInline, summarizeSets } from '../utils/aggregate';
import { formatMonthDay } from '../utils/datetime';
import { formatTimer } from '../utils/format';
import { rmDivisorFor } from '../utils/oneRepMax';
import { formatVolume, formatWeight } from '../utils/number';
import { SetEditor } from './SetEditor';

export function WorkoutExerciseList({
  workoutExercises,
  visibleSets,
  exerciseById,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
  showTimer,
  previousSessionByExerciseId,
}: {
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  showTimer: boolean;
  // 前回実績（記録中のみ渡す）。種目IDごとの直近の完了済み実施記録。
  previousSessionByExerciseId?: Map<string, ExerciseSession | null>;
}) {
  return (
    <>
      {workoutExercises.map((workoutExercise) => {
        const exercise = exerciseById.get(workoutExercise.exerciseId);
        const sets = visibleSets
          .filter((set) => set.workoutExerciseId === workoutExercise.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        // ウォームアップを除いた集計。規則は utils/aggregate.ts に集約している。
        const summary = summarizeSets(sets, rmDivisorFor(workoutExercise.exerciseId));
        const restSeconds =
          workoutExercise.restSecondsOverride ?? exercise?.defaultRestSeconds ?? 120;
        const previousSession = previousSessionByExerciseId?.get(workoutExercise.exerciseId);
        return (
          <View key={workoutExercise.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.flex}>
                <Text style={styles.exerciseTitle}>{exercise?.name ?? '種目'}</Text>
                <Text style={styles.faint}>
                  {summary.setCount} セット
                  {summary.warmupCount > 0 ? `（＋WU ${summary.warmupCount}）` : ''} ・{' '}
                  {formatVolume(summary.totalVolume)} ・ 推定1RM{' '}
                  {formatWeight(summary.bestOneRepMax)}
                </Text>
              </View>
              <Pressable style={styles.smallButton} onPress={() => onAddSet(workoutExercise)}>
                <Text style={styles.smallButtonText}>＋ セット</Text>
              </Pressable>
            </View>
            <View style={styles.sectionBody}>
              {previousSessionByExerciseId ? (
                previousSession ? (
                  <Text style={styles.muted}>
                    前回 {formatMonthDay(previousSession.workout.performedAt)} ・{' '}
                    {formatSetsInline(previousSession.sets)} ・ ベスト1RM{' '}
                    {formatWeight(previousSession.summary.bestOneRepMax)}
                  </Text>
                ) : (
                  <Text style={styles.faint}>
                    この種目は初めてです。今日の記録が次回の目安になります。
                  </Text>
                )
              ) : null}
              {showTimer ? (
                <Pressable
                  style={styles.restRow}
                  onPress={() => exercise && onOpenRestPicker(exercise.id, restSeconds)}
                >
                  <Text style={styles.muted}>休憩タイマー</Text>
                  <Text style={styles.restValue}>{formatTimer(restSeconds)} ›</Text>
                </Pressable>
              ) : null}
              {sets.length === 0 ? (
                <Text style={styles.muted}>セットを追加すると、すぐ保存されます。</Text>
              ) : null}
              {sets.map((set, index) => (
                <SetEditor
                  key={set.id}
                  set={set}
                  setNumber={index + 1}
                  workoutExercise={workoutExercise}
                  onPatchSet={onPatchSet}
                  onStartRestTimer={onStartRestTimer}
                  showTimer={showTimer}
                />
              ))}
            </View>
          </View>
        );
      })}
    </>
  );
}
