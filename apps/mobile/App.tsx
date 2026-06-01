import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
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
import { ExerciseScreen } from './src/screens/ExerciseScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { styles } from './src/styles/appStyles';
import type { Tab, WorkoutExercise, WorkoutSet } from './src/types/domain';

export default function App() {
  const data = useWorkoutData();
  const { timer, setTimer } = useRestTimer();

  // UI（ナビゲーション・入力・編集状態）はシェルである App が保持する。
  const [tab, setTab] = useState<Tab>('home');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [restPicker, setRestPicker] = useState<{ exerciseId: string; seconds: number } | null>(
    null,
  );

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
          <View>
            <Text style={styles.appName}>Workout Habit</Text>
            <Text style={styles.headerSub}>記録は都度保存。間違えても後から直せます。</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MVP</Text>
          </View>
        </View>

        {timer ? <TimerBanner timer={timer} setTimer={setTimer} /> : null}

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

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'home' ? (
            <HomeScreen
              activeWorkout={data.activeWorkout}
              completedWorkouts={data.completedWorkouts}
              stats={data.stats}
              onStart={handleStart}
              onResume={() => setTab('workout')}
            />
          ) : null}

          {tab === 'workout' ? (
            <WorkoutScreen
              activeWorkout={data.activeWorkout}
              workoutExercises={data.activeWorkoutExercises}
              visibleSets={data.visibleSets}
              exercises={data.exercises}
              exerciseById={data.exerciseById}
              bodyPartById={data.bodyPartById}
              onStart={handleStart}
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
            />
          ) : null}

          {tab === 'exercises' ? (
            <ExerciseScreen
              bodyParts={data.bodyParts}
              exercises={data.exercises}
              bodyPartById={data.bodyPartById}
              newExerciseName={newExerciseName}
              onChangeNewExerciseName={setNewExerciseName}
              onAddCustomExercise={handleAddCustomExercise}
              onOpenRestPicker={openRestPicker}
            />
          ) : null}
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
