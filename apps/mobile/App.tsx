import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { RestPickerModal } from './src/components/RestPickerModal';
import { TimerBanner } from './src/components/TimerBanner';
import { useRestTimer } from './src/hooks/useRestTimer';
import { useWorkoutData } from './src/hooks/useWorkoutData';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetailScreen';
import { ExerciseScreen } from './src/screens/ExerciseScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { styles } from './src/styles/appStyles';
import type { Tab, WorkoutExercise, WorkoutSet } from './src/types/domain';
import type { ExerciseSession } from './src/utils/aggregate';
import { buildExerciseSessions, findPreviousSession } from './src/utils/aggregate';

export default function App() {
  const data = useWorkoutData();
  const { timer, setTimer } = useRestTimer(data.timerSettings);

  // UI（ナビゲーション・入力・編集状態）はシェルである App が保持する。
  const [tab, setTab] = useState<Tab>('home');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [restPicker, setRestPicker] = useState<{ exerciseId: string; seconds: number } | null>(
    null,
  );

  // 記録中の各種目について、直近の完了済み実施記録（前回実績）を引く。
  const previousSessionByExerciseId = useMemo(() => {
    const map = new Map<string, ExerciseSession | null>();
    if (!data.activeWorkout) {
      return map;
    }
    for (const workoutExercise of data.activeWorkoutExercises) {
      map.set(
        workoutExercise.exerciseId,
        findPreviousSession(
          workoutExercise.exerciseId,
          data.activeWorkout.id,
          data.completedWorkouts,
          data.workoutExercises,
          data.visibleSets,
        ),
      );
    }
    return map;
  }, [
    data.activeWorkout,
    data.activeWorkoutExercises,
    data.completedWorkouts,
    data.workoutExercises,
    data.visibleSets,
  ]);

  const selectedExercise = selectedExerciseId
    ? (data.exerciseById.get(selectedExerciseId) ?? null)
    : null;
  const selectedExerciseSessions = useMemo(() => {
    if (!selectedExerciseId) {
      return [];
    }
    return buildExerciseSessions(
      selectedExerciseId,
      data.completedWorkouts,
      data.workoutExercises,
      data.visibleSets,
    );
  }, [selectedExerciseId, data.completedWorkouts, data.workoutExercises, data.visibleSets]);

  const handleStart = async () => {
    await data.startWorkout();
    setTab('workout');
  };

  const handleComplete = async () => {
    await data.completeWorkout();
    setTab('history');
  };

  const handlePause = async () => {
    await data.pauseWorkout();
    setTab('home');
  };

  const handleStartRestTimer = async (set: WorkoutSet, workoutExercise: WorkoutExercise) => {
    const nextTimer = await data.beginRestTimer(set, workoutExercise);
    setTimer(nextTimer);
  };

  const handleAddCustomExercise = async () => {
    const added = await data.addCustomExercise(newExerciseName);
    if (added) {
      setNewExerciseName('');
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    setEditingWorkoutId(null);
    await data.deleteWorkout(workoutId);
  };

  const openRestPicker = (exerciseId: string, seconds: number) => {
    setRestPicker({ exerciseId, seconds });
  };

  const confirmRestPicker = async (seconds: number) => {
    if (restPicker) {
      const exercise = data.exerciseById.get(restPicker.exerciseId);
      if (exercise) {
        await data.updateExerciseRest(exercise, Math.max(0, seconds));
      }
    }
    setRestPicker(null);
  };

  if (data.errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>起動できませんでした</Text>
          <Text style={styles.muted}>{data.errorMessage}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data.isReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Workout Habit</Text>
          <Text style={styles.muted}>ローカルDBを準備しています</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          {selectedExercise ? (
            <Pressable style={styles.headerBackButton} onPress={() => setSelectedExerciseId(null)}>
              <Text style={styles.headerBackText}>‹</Text>
              <Text style={styles.appName}>{selectedExercise.name}</Text>
            </Pressable>
          ) : (
            <Text style={styles.appName}>Workout Habit</Text>
          )}
        </View>

        {timer ? <TimerBanner timer={timer} setTimer={setTimer} /> : null}

        {selectedExercise ? null : (
          <View style={styles.tabs}>
            {(
              [
                ['home', 'ホーム'],
                ['workout', '記録'],
                ['history', '履歴'],
                ['exercises', '種目'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.tab, tab === key && styles.activeTab]}
              >
                <Text style={[styles.tabText, tab === key && styles.activeTabText]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {selectedExercise ? (
            <ExerciseDetailScreen exercise={selectedExercise} sessions={selectedExerciseSessions} />
          ) : (
            <>
              {tab === 'home' ? (
                <HomeScreen
                  activeWorkout={data.activeWorkout}
                  completedWorkouts={data.completedWorkouts}
                  workoutExercises={data.workoutExercises}
                  visibleSets={data.visibleSets}
                  exerciseById={data.exerciseById}
                  stats={data.stats}
                  bodyPartSummaries={data.weeklyBodyPartSummary}
                  onStart={handleStart}
                  onResume={() => setTab('workout')}
                />
              ) : null}

              {tab === 'workout' ? (
                <WorkoutScreen
                  activeWorkout={data.activeWorkout}
                  workoutExercises={data.activeWorkoutExercises}
                  visibleSets={data.visibleSets}
                  exercises={data.exercisesByUsage}
                  exerciseById={data.exerciseById}
                  bodyPartById={data.bodyPartById}
                  previousSessionByExerciseId={previousSessionByExerciseId}
                  templates={data.templates}
                  templateExercises={data.templateExercises}
                  onStart={handleStart}
                  onStartFromTemplate={data.startWorkoutFromTemplate}
                  onSaveTemplate={(name) => void data.saveActiveWorkoutAsTemplate(name)}
                  onDeleteTemplate={data.deleteTemplate}
                  onComplete={handleComplete}
                  onPause={handlePause}
                  onAddExercise={data.addExerciseToWorkout}
                  onAddSet={data.addSet}
                  onPatchSet={data.patchSet}
                  onStartRestTimer={handleStartRestTimer}
                  onOpenRestPicker={openRestPicker}
                />
              ) : null}

              {tab === 'history' ? (
                <HistoryScreen
                  workouts={data.completedWorkouts}
                  workoutExercises={data.workoutExercises}
                  visibleSets={data.visibleSets}
                  exerciseById={data.exerciseById}
                  editingWorkoutId={editingWorkoutId}
                  onEdit={setEditingWorkoutId}
                  onStopEdit={() => setEditingWorkoutId(null)}
                  onAddSet={data.addSet}
                  onPatchSet={data.patchSet}
                  onStartRestTimer={handleStartRestTimer}
                  onOpenRestPicker={openRestPicker}
                  onDeleteWorkout={handleDeleteWorkout}
                  onSelectExercise={setSelectedExerciseId}
                />
              ) : null}

              {tab === 'exercises' ? (
                <ExerciseScreen
                  bodyParts={data.bodyParts}
                  exercises={data.exercises}
                  bodyPartById={data.bodyPartById}
                  newExerciseName={newExerciseName}
                  timerSettings={data.timerSettings}
                  onChangeNewExerciseName={setNewExerciseName}
                  onAddCustomExercise={handleAddCustomExercise}
                  onOpenRestPicker={openRestPicker}
                  onSelectExercise={setSelectedExerciseId}
                  onUpdateTimerSettings={(settings) => void data.updateTimerSettings(settings)}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {restPicker ? (
        <RestPickerModal
          value={restPicker.seconds}
          onConfirm={confirmRestPicker}
          onCancel={() => setRestPicker(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
