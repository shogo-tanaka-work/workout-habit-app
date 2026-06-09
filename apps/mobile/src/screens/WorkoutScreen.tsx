import { Pressable, Text, View } from 'react-native';

import { StatStrip } from '../components/StatStrip';
import { WorkoutExerciseList } from '../components/WorkoutExerciseList';
import { styles } from '../styles/appStyles';
import type {
  BodyPart,
  Exercise,
  SetPatch,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';
import { summarizeSets } from '../utils/aggregate';
import { formatTimer } from '../utils/format';

export function WorkoutScreen({
  activeWorkout,
  workoutExercises,
  visibleSets,
  exercises,
  exerciseById,
  bodyPartById,
  previousSessionByExerciseId,
  onStart,
  onComplete,
  onPause,
  onAddExercise,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
}: {
  activeWorkout: Workout | null;
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exercises: Exercise[];
  exerciseById: Map<string, Exercise>;
  bodyPartById: Map<string, BodyPart>;
  previousSessionByExerciseId: Map<string, ExerciseSession | null>;
  onStart: () => void;
  onComplete: () => void;
  onPause: () => void;
  onAddExercise: (exercise: Exercise) => void;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
}) {
  if (!activeWorkout) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionBody}>
          <Text style={styles.sectionTitle}>記録中のワークアウトはありません</Text>
          <Text style={styles.muted}>まず今日のワークアウトを開始しましょう。</Text>
          <Pressable style={styles.primaryButton} onPress={onStart}>
            <Text style={styles.primaryButtonText}>ワークアウト開始</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const activeSets = visibleSets.filter((set) =>
    workoutExercises.some((item) => item.id === set.workoutExerciseId),
  );
  const summary = summarizeSets(activeSets);

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionHeaderText}>今日のワークアウト</Text>
            <Text style={styles.faint}>
              最終保存{' '}
              {new Date(activeWorkout.lastSavedAt).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.ghostButton} onPress={onPause}>
              <Text style={styles.ghostButtonText}>一時保存</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={onComplete}>
              <Text style={styles.secondaryButtonText}>完了</Text>
            </Pressable>
          </View>
        </View>
        <StatStrip
          items={[
            { label: '種目', value: `${workoutExercises.length}` },
            { label: 'セット', value: `${summary.setCount}` },
            {
              label: 'ボリューム',
              value: `${Math.round(summary.totalVolume).toLocaleString()} kg`,
            },
            { label: '総レップ数', value: `${summary.totalReps} 回` },
          ]}
        />
      </View>

      <WorkoutExerciseList
        workoutExercises={workoutExercises}
        visibleSets={visibleSets}
        exerciseById={exerciseById}
        onAddSet={onAddSet}
        onPatchSet={onPatchSet}
        onStartRestTimer={onStartRestTimer}
        onOpenRestPicker={onOpenRestPicker}
        showTimer
        previousSessionByExerciseId={previousSessionByExerciseId}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>種目を追加</Text>
        </View>
        <View style={styles.sectionBody}>
          <View style={styles.chipWrap}>
            {exercises.map((exercise) => {
              const bodyPart = bodyPartById.get(exercise.primaryBodyPartId);
              return (
                <Pressable
                  key={exercise.id}
                  style={styles.exerciseChip}
                  onPress={() => onAddExercise(exercise)}
                >
                  <Text style={styles.exerciseChipText}>{exercise.name}</Text>
                  <Text style={styles.exerciseChipSub}>
                    {bodyPart?.name ?? '未分類'} ・ 休憩 {formatTimer(exercise.defaultRestSeconds)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}
