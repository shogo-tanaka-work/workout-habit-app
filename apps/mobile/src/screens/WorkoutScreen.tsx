import { Pressable, Text, View } from 'react-native';

import { Metric } from '../components/Metric';
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
import { formatTimer } from '../utils/format';

export function WorkoutScreen({
  activeWorkout,
  workoutExercises,
  visibleSets,
  exercises,
  exerciseById,
  bodyPartById,
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
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>記録中のワークアウトはありません</Text>
        <Text style={styles.muted}>まず今日のワークアウトを開始しましょう。</Text>
        <Pressable style={styles.primaryButton} onPress={onStart}>
          <Text style={styles.primaryButtonText}>ワークアウト開始</Text>
        </Pressable>
      </View>
    );
  }

  const activeSetCount = visibleSets.filter((set) =>
    workoutExercises.some((item) => item.id === set.workoutExerciseId),
  ).length;
  const activeVolume = visibleSets
    .filter((set) => workoutExercises.some((item) => item.id === set.workoutExerciseId))
    .reduce((sum, set) => sum + set.weightKg * set.reps, 0);

  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.sectionTitle}>今日のワークアウト</Text>
            <Text style={styles.muted}>
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
        <View style={styles.metricGrid}>
          <Metric label="種目" value={`${workoutExercises.length}`} />
          <Metric label="セット" value={`${activeSetCount}`} />
          <Metric label="ボリューム" value={`${Math.round(activeVolume).toLocaleString()}kg`} />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>種目を追加</Text>
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
                  {bodyPart?.name ?? '未分類'} / {formatTimer(exercise.defaultRestSeconds)}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
      />
    </View>
  );
}
