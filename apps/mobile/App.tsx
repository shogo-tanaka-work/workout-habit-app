import { StatusBar } from 'expo-status-bar';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as SQLite from 'expo-sqlite';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

import timerCompleteSound from './assets/timer-complete.wav';

type Tab = 'home' | 'workout' | 'history' | 'exercises';

type BodyPart = {
  id: string;
  name: string;
  orderIndex: number;
};

type Exercise = {
  id: string;
  name: string;
  primaryBodyPartId: string;
  defaultRestSeconds: number;
  defaultBarWeightKg: number;
  category: string;
  isArchived: boolean;
};

type Workout = {
  id: string;
  performedAt: string;
  status: 'active' | 'completed';
  memo: string;
  lastSavedAt: string;
  createdAt: string;
};

type WorkoutExercise = {
  id: string;
  workoutId: string;
  exerciseId: string;
  orderIndex: number;
  restSecondsOverride: number | null;
  memo: string;
};

type WorkoutSet = {
  id: string;
  workoutExerciseId: string;
  orderIndex: number;
  weightKg: number;
  reps: number;
  rpe: number;
  isWarmup: boolean;
  isCompleted: boolean;
  memo: string;
  restSeconds: number;
  deletedAt: string | null;
};

type TimerState = {
  workoutSetId: string;
  exerciseName: string;
  duration: number;
  remaining: number;
  running: boolean;
  finished: boolean;
  notified: boolean;
  endsAt: number | null;
};

type BodyPartRow = {
  id: string;
  name: string;
  order_index: number;
};

type ExerciseRow = {
  id: string;
  name: string;
  primary_body_part_id: string;
  default_rest_seconds: number;
  default_bar_weight_kg: number;
  category: string;
  is_archived: number;
};

type WorkoutRow = {
  id: string;
  performed_at: string;
  status: 'active' | 'completed';
  memo: string;
  last_saved_at: string;
  created_at: string;
};

type WorkoutExerciseRow = {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  rest_seconds_override: number | null;
  memo: string;
};

type WorkoutSetRow = {
  id: string;
  workout_exercise_id: string;
  order_index: number;
  weight_kg: number;
  reps: number;
  rpe: number;
  is_warmup: number;
  is_completed: number;
  memo: string;
  rest_seconds: number;
  deleted_at: string | null;
};

type SetPatch = Partial<
  Pick<WorkoutSet, 'weightKg' | 'reps' | 'rpe' | 'isWarmup' | 'isCompleted' | 'memo' | 'restSeconds' | 'deletedAt'>
>;

const seedBodyParts: BodyPart[] = [
  { id: 'chest', name: '胸', orderIndex: 1 },
  { id: 'back', name: '背中', orderIndex: 2 },
  { id: 'legs', name: '脚', orderIndex: 3 },
  { id: 'shoulders', name: '肩', orderIndex: 4 },
  { id: 'arms', name: '腕', orderIndex: 5 },
  { id: 'core', name: '体幹', orderIndex: 6 },
  { id: 'cardio', name: '有酸素', orderIndex: 7 },
];

const seedExercises: Exercise[] = [
  {
    id: 'bench-press',
    name: 'ベンチプレス',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'deadlift',
    name: 'デッドリフト',
    primaryBodyPartId: 'back',
    defaultRestSeconds: 180,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'squat',
    name: 'スクワット',
    primaryBodyPartId: 'legs',
    defaultRestSeconds: 180,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'pull-up',
    name: '懸垂',
    primaryBodyPartId: 'back',
    defaultRestSeconds: 120,
    defaultBarWeightKg: 0,
    category: 'bodyweight',
    isArchived: false,
  },
  {
    id: 'dumbbell-press',
    name: 'ダンベルプレス',
    primaryBodyPartId: 'chest',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 0,
    category: 'strength',
    isArchived: false,
  },
  {
    id: 'shoulder-press',
    name: 'ショルダープレス',
    primaryBodyPartId: 'shoulders',
    defaultRestSeconds: 90,
    defaultBarWeightKg: 20,
    category: 'strength',
    isArchived: false,
  },
];

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const nowIso = (): string => new Date().toISOString();
const newId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const formatTimer = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};
const estimateOneRepMax = (weightKg: number, reps: number): number => {
  if (weightKg <= 0 || reps <= 0) {
    return 0;
  }
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
};

const toBodyPart = (row: BodyPartRow): BodyPart => ({
  id: row.id,
  name: row.name,
  orderIndex: row.order_index,
});

const toExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  name: row.name,
  primaryBodyPartId: row.primary_body_part_id,
  defaultRestSeconds: row.default_rest_seconds,
  defaultBarWeightKg: row.default_bar_weight_kg,
  category: row.category,
  isArchived: row.is_archived === 1,
});

const toWorkout = (row: WorkoutRow): Workout => ({
  id: row.id,
  performedAt: row.performed_at,
  status: row.status,
  memo: row.memo,
  lastSavedAt: row.last_saved_at,
  createdAt: row.created_at,
});

const toWorkoutExercise = (row: WorkoutExerciseRow): WorkoutExercise => ({
  id: row.id,
  workoutId: row.workout_id,
  exerciseId: row.exercise_id,
  orderIndex: row.order_index,
  restSecondsOverride: row.rest_seconds_override,
  memo: row.memo,
});

const toWorkoutSet = (row: WorkoutSetRow): WorkoutSet => ({
  id: row.id,
  workoutExerciseId: row.workout_exercise_id,
  orderIndex: row.order_index,
  weightKg: row.weight_kg,
  reps: row.reps,
  rpe: row.rpe,
  isWarmup: row.is_warmup === 1,
  isCompleted: row.is_completed === 1,
  memo: row.memo,
  restSeconds: row.rest_seconds,
  deletedAt: row.deleted_at,
});

export default function App() {
  const timerPlayer = useAudioPlayer(timerCompleteSound);
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([]);
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [restPicker, setRestPicker] = useState<{ exerciseId: string; seconds: number } | null>(null);

  const activeWorkout = useMemo(
    () => workouts.find((workout) => workout.status === 'active') ?? null,
    [workouts],
  );

  const visibleSets = useMemo(
    () => workoutSets.filter((set) => set.deletedAt === null),
    [workoutSets],
  );

  const exerciseById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const bodyPartById = useMemo(() => new Map(bodyParts.map((bodyPart) => [bodyPart.id, bodyPart])), [bodyParts]);
  const workoutExerciseById = useMemo(
    () => new Map(workoutExercises.map((item) => [item.id, item])),
    [workoutExercises],
  );

  const activeWorkoutExercises = useMemo(() => {
    if (!activeWorkout) {
      return [];
    }
    return workoutExercises
      .filter((item) => item.workoutId === activeWorkout.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [activeWorkout, workoutExercises]);

  const completedWorkouts = useMemo(
    () => workouts.filter((workout) => workout.status === 'completed').sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
    [workouts],
  );

  const reloadData = useCallback(async (database: SQLite.SQLiteDatabase) => {
    const [bodyPartRows, exerciseRows, workoutRows, workoutExerciseRows, workoutSetRows] = await Promise.all([
      database.getAllAsync<BodyPartRow>('SELECT * FROM body_parts ORDER BY order_index'),
      database.getAllAsync<ExerciseRow>('SELECT * FROM exercises WHERE is_archived = 0 ORDER BY name'),
      database.getAllAsync<WorkoutRow>('SELECT * FROM workouts ORDER BY created_at DESC'),
      database.getAllAsync<WorkoutExerciseRow>('SELECT * FROM workout_exercises ORDER BY order_index'),
      database.getAllAsync<WorkoutSetRow>('SELECT * FROM workout_sets ORDER BY order_index'),
    ]);
    setBodyParts(bodyPartRows.map(toBodyPart));
    setExercises(exerciseRows.map(toExercise));
    setWorkouts(workoutRows.map(toWorkout));
    setWorkoutExercises(workoutExerciseRows.map(toWorkoutExercise));
    setWorkoutSets(workoutSetRows.map(toWorkoutSet));
  }, []);

  const updateWorkoutSavedAt = useCallback(
    async (database: SQLite.SQLiteDatabase, workoutId: string) => {
      await database.runAsync('UPDATE workouts SET last_saved_at = ?, updated_at = ? WHERE id = ?', nowIso(), nowIso(), workoutId);
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const database = await SQLite.openDatabaseAsync('workout-habit.db');
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS body_parts (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            order_index INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS exercises (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            primary_body_part_id TEXT NOT NULL,
            default_rest_seconds INTEGER NOT NULL,
            default_bar_weight_kg REAL NOT NULL,
            category TEXT NOT NULL,
            is_archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS workouts (
            id TEXT PRIMARY KEY NOT NULL,
            performed_at TEXT NOT NULL,
            status TEXT NOT NULL,
            memo TEXT NOT NULL DEFAULT '',
            last_saved_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS workout_exercises (
            id TEXT PRIMARY KEY NOT NULL,
            workout_id TEXT NOT NULL,
            exercise_id TEXT NOT NULL,
            order_index INTEGER NOT NULL,
            rest_seconds_override INTEGER,
            memo TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS workout_sets (
            id TEXT PRIMARY KEY NOT NULL,
            workout_exercise_id TEXT NOT NULL,
            order_index INTEGER NOT NULL,
            weight_kg REAL NOT NULL,
            reps INTEGER NOT NULL,
            rpe REAL NOT NULL,
            is_warmup INTEGER NOT NULL DEFAULT 0,
            is_completed INTEGER NOT NULL DEFAULT 0,
            memo TEXT NOT NULL DEFAULT '',
            rest_seconds INTEGER NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS timer_events (
            id TEXT PRIMARY KEY NOT NULL,
            workout_set_id TEXT NOT NULL,
            exercise_id TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            status TEXT NOT NULL,
            sound_enabled INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        for (const bodyPart of seedBodyParts) {
          await database.runAsync(
            'INSERT OR IGNORE INTO body_parts (id, name, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
            bodyPart.id,
            bodyPart.name,
            bodyPart.orderIndex,
            nowIso(),
            nowIso(),
          );
        }
        for (const exercise of seedExercises) {
          await database.runAsync(
            `INSERT OR IGNORE INTO exercises
              (id, name, primary_body_part_id, default_rest_seconds, default_bar_weight_kg, category, is_archived, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            exercise.id,
            exercise.name,
            exercise.primaryBodyPartId,
            exercise.defaultRestSeconds,
            exercise.defaultBarWeightKg,
            exercise.category,
            exercise.isArchived ? 1 : 0,
            nowIso(),
            nowIso(),
          );
        }

        if (mounted) {
          setDb(database);
          await reloadData(database);
          setIsReady(true);
        }
      } catch (error: unknown) {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : 'アプリ初期化に失敗しました');
        }
      }
    };
    void setup();
    return () => {
      mounted = false;
    };
  }, [reloadData]);

  useEffect(() => {
    if (!timer?.running) {
      return;
    }
    const interval = setInterval(() => {
      setTimer((current) => {
        if (!current?.running) {
          return current;
        }
        const remaining = current.endsAt ? Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)) : current.remaining;
        if (remaining <= 0) {
          return { ...current, remaining: 0, running: false, finished: true, endsAt: null };
        }
        return { ...current, remaining };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer?.running]);

  useEffect(() => {
    if (!timer?.finished || timer.notified) {
      return;
    }
    Vibration.vibrate([0, 280, 120, 280]);
    void timerPlayer
      .seekTo(0)
      .then(() => timerPlayer.play())
      .catch(() => {
        // The visible timer-complete state remains useful even if audio playback fails.
      });
    setTimer((current) => (current && current.workoutSetId === timer.workoutSetId ? { ...current, notified: true } : current));
  }, [timer?.finished, timer?.notified, timer?.workoutSetId, timerPlayer]);

  const ensureDb = (): SQLite.SQLiteDatabase => {
    if (!db) {
      throw new Error('データベースの準備がまだ終わっていません');
    }
    return db;
  };

  const startWorkout = async () => {
    const database = ensureDb();
    const existingActive = await database.getFirstAsync<WorkoutRow>("SELECT * FROM workouts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
    if (existingActive) {
      await reloadData(database);
      setTab('workout');
      return;
    }
    const id = newId('workout');
    const timestamp = nowIso();
    await database.runAsync(
      'INSERT INTO workouts (id, performed_at, status, memo, last_saved_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      formatDate(new Date()),
      'active',
      '',
      timestamp,
      timestamp,
      timestamp,
    );
    await reloadData(database);
    setTab('workout');
  };

  const completeWorkout = async () => {
    if (!activeWorkout) {
      return;
    }
    const database = ensureDb();
    await database.runAsync('UPDATE workouts SET status = ?, last_saved_at = ?, updated_at = ? WHERE id = ?', 'completed', nowIso(), nowIso(), activeWorkout.id);
    await reloadData(database);
    setTab('history');
  };

  const pauseWorkout = async () => {
    if (activeWorkout) {
      await updateWorkoutSavedAt(ensureDb(), activeWorkout.id);
    }
    setTab('home');
  };

  const deleteWorkout = async (workoutId: string) => {
    const database = ensureDb();
    const items = workoutExercises.filter((item) => item.workoutId === workoutId);
    for (const item of items) {
      await database.runAsync('DELETE FROM workout_sets WHERE workout_exercise_id = ?', item.id);
    }
    await database.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', workoutId);
    await database.runAsync('DELETE FROM workouts WHERE id = ?', workoutId);
    setEditingWorkoutId(null);
    await reloadData(database);
  };

  const addExerciseToWorkout = async (exercise: Exercise) => {
    const database = ensureDb();
    const workout = activeWorkout;
    if (!workout) {
      await startWorkout();
      return;
    }
    const alreadyAdded = activeWorkoutExercises.some((item) => item.exerciseId === exercise.id);
    if (alreadyAdded) {
      Alert.alert('追加済み', `${exercise.name} は今日の記録に入っています。`);
      return;
    }
    const timestamp = nowIso();
    await database.runAsync(
      `INSERT INTO workout_exercises
        (id, workout_id, exercise_id, order_index, rest_seconds_override, memo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId('workout-exercise'),
      workout.id,
      exercise.id,
      activeWorkoutExercises.length + 1,
      null,
      '',
      timestamp,
      timestamp,
    );
    await updateWorkoutSavedAt(database, workout.id);
    await reloadData(database);
  };

  const addSet = async (workoutExercise: WorkoutExercise) => {
    const database = ensureDb();
    const exercise = exerciseById.get(workoutExercise.exerciseId);
    const allSetsForExercise = workoutSets.filter((set) => set.workoutExerciseId === workoutExercise.id);
    const currentSets = allSetsForExercise.filter((set) => set.deletedAt === null);
    const previousSet = currentSets.at(-1);
    const nextOrderIndex = allSetsForExercise.reduce((max, set) => Math.max(max, set.orderIndex), 0) + 1;
    const timestamp = nowIso();
    await database.runAsync(
      `INSERT INTO workout_sets
        (id, workout_exercise_id, order_index, weight_kg, reps, rpe, is_warmup, is_completed, memo, rest_seconds, started_at, completed_at, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId('set'),
      workoutExercise.id,
      nextOrderIndex,
      previousSet?.weightKg ?? exercise?.defaultBarWeightKg ?? 0,
      previousSet?.reps ?? 8,
      previousSet?.rpe ?? 8,
      0,
      0,
      '',
      workoutExercise.restSecondsOverride ?? exercise?.defaultRestSeconds ?? 120,
      timestamp,
      null,
      null,
      timestamp,
      timestamp,
    );
    if (workoutExercise.workoutId) {
      await updateWorkoutSavedAt(database, workoutExercise.workoutId);
    }
    await reloadData(database);
  };

  const patchSet = async (setId: string, patch: SetPatch) => {
    const database = ensureDb();
    const current = workoutSets.find((set) => set.id === setId);
    if (!current) {
      return;
    }
    const next: WorkoutSet = { ...current, ...patch };
    await database.runAsync(
      `UPDATE workout_sets
       SET weight_kg = ?, reps = ?, rpe = ?, is_warmup = ?, is_completed = ?, memo = ?, rest_seconds = ?, deleted_at = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
      next.weightKg,
      next.reps,
      next.rpe,
      next.isWarmup ? 1 : 0,
      next.isCompleted ? 1 : 0,
      next.memo,
      next.restSeconds,
      next.deletedAt,
      next.isCompleted ? nowIso() : null,
      nowIso(),
      setId,
    );
    const owningWorkoutId = workoutExerciseById.get(current.workoutExerciseId)?.workoutId;
    if (owningWorkoutId) {
      await updateWorkoutSavedAt(database, owningWorkoutId);
    }
    await reloadData(database);
  };

  const startRestTimer = async (set: WorkoutSet, workoutExercise: WorkoutExercise) => {
    const database = ensureDb();
    const exercise = exerciseById.get(workoutExercise.exerciseId);
    const duration = Math.max(1, workoutExercise.restSecondsOverride ?? exercise?.defaultRestSeconds ?? set.restSeconds ?? 120);
    await patchSet(set.id, { isCompleted: true, restSeconds: duration });
    const timestamp = nowIso();
    await database.runAsync(
      `INSERT INTO timer_events
        (id, workout_set_id, exercise_id, duration_seconds, started_at, ended_at, status, sound_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId('timer'),
      set.id,
      workoutExercise.exerciseId,
      duration,
      timestamp,
      null,
      'running',
      1,
      timestamp,
      timestamp,
    );
    setTimer({
      workoutSetId: set.id,
      exerciseName: exercise?.name ?? '種目',
      duration,
      remaining: duration,
      running: true,
      finished: false,
      notified: false,
      endsAt: Date.now() + duration * 1000,
    });
  };

  const addCustomExercise = async () => {
    const name = newExerciseName.trim();
    if (!name) {
      return;
    }
    const database = ensureDb();
    const timestamp = nowIso();
    await database.runAsync(
      `INSERT INTO exercises
        (id, name, primary_body_part_id, default_rest_seconds, default_bar_weight_kg, category, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId('exercise'),
      name,
      bodyParts[0]?.id ?? 'chest',
      120,
      0,
      'strength',
      0,
      timestamp,
      timestamp,
    );
    setNewExerciseName('');
    await reloadData(database);
  };

  const updateExerciseRest = async (exercise: Exercise, restSeconds: number) => {
    const database = ensureDb();
    await database.runAsync('UPDATE exercises SET default_rest_seconds = ?, updated_at = ? WHERE id = ?', restSeconds, nowIso(), exercise.id);
    await reloadData(database);
  };

  const openRestPicker = (exerciseId: string, seconds: number) => {
    setRestPicker({ exerciseId, seconds });
  };

  const confirmRestPicker = async (seconds: number) => {
    if (restPicker) {
      const exercise = exerciseById.get(restPicker.exerciseId);
      if (exercise) {
        await updateExerciseRest(exercise, Math.max(0, seconds));
      }
    }
    setRestPicker(null);
  };

  const stats = useMemo(() => {
    const completedSetCount = visibleSets.filter((set) => set.isCompleted).length;
    const totalVolume = visibleSets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
    const totalReps = visibleSets.reduce((sum, set) => sum + set.reps, 0);
    return { completedSetCount, totalVolume, totalReps };
  }, [visibleSets]);

  if (errorMessage) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>起動できませんでした</Text>
          <Text style={styles.muted}>{errorMessage}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isReady) {
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
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
          {([
            ['home', 'ホーム'],
            ['workout', '記録'],
            ['history', '履歴'],
            ['exercises', '種目'],
          ] as const).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.activeTab]}>
              <Text style={[styles.tabText, tab === key && styles.activeTabText]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
          {tab === 'home' ? (
            <HomeScreen
              activeWorkout={activeWorkout}
              completedWorkouts={completedWorkouts}
              stats={stats}
              onStart={startWorkout}
              onResume={() => setTab('workout')}
            />
          ) : null}

          {tab === 'workout' ? (
            <WorkoutScreen
              activeWorkout={activeWorkout}
              workoutExercises={activeWorkoutExercises}
              visibleSets={visibleSets}
              exercises={exercises}
              exerciseById={exerciseById}
              bodyPartById={bodyPartById}
              onStart={startWorkout}
              onComplete={completeWorkout}
              onPause={pauseWorkout}
              onAddExercise={addExerciseToWorkout}
              onAddSet={addSet}
              onPatchSet={patchSet}
              onStartRestTimer={startRestTimer}
              onOpenRestPicker={openRestPicker}
            />
          ) : null}

          {tab === 'history' ? (
            <HistoryScreen
              workouts={completedWorkouts}
              workoutExercises={workoutExercises}
              visibleSets={visibleSets}
              exerciseById={exerciseById}
              editingWorkoutId={editingWorkoutId}
              onEdit={setEditingWorkoutId}
              onStopEdit={() => setEditingWorkoutId(null)}
              onAddSet={addSet}
              onPatchSet={patchSet}
              onStartRestTimer={startRestTimer}
              onOpenRestPicker={openRestPicker}
              onDeleteWorkout={deleteWorkout}
            />
          ) : null}

          {tab === 'exercises' ? (
            <ExerciseScreen
              bodyParts={bodyParts}
              exercises={exercises}
              bodyPartById={bodyPartById}
              newExerciseName={newExerciseName}
              onChangeNewExerciseName={setNewExerciseName}
              onAddCustomExercise={addCustomExercise}
              onOpenRestPicker={openRestPicker}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {restPicker ? (
        <RestPickerModal value={restPicker.seconds} onConfirm={confirmRestPicker} onCancel={() => setRestPicker(null)} />
      ) : null}
    </SafeAreaView>
  );
}

function TimerBanner({ timer, setTimer }: { timer: TimerState; setTimer: Dispatch<SetStateAction<TimerState | null>> }) {
  const toggleRunning = () => {
    setTimer((current) => {
      if (!current || current.finished) {
        return current;
      }
      if (current.running) {
        return { ...current, running: false, endsAt: null };
      }
      return { ...current, running: true, endsAt: Date.now() + current.remaining * 1000 };
    });
  };

  return (
    <View style={[styles.timerBanner, timer.finished && styles.timerFinished]}>
      <View>
        <Text style={styles.timerLabel}>{timer.finished ? '休憩終了' : '休憩タイマー'}</Text>
        <Text style={styles.timerTitle}>{timer.exerciseName}</Text>
      </View>
      <Text style={styles.timerTime}>{formatTimer(timer.remaining)}</Text>
      <View style={styles.timerActions}>
        <Pressable style={styles.iconButton} onPress={toggleRunning}>
          <Text style={styles.iconButtonText}>{timer.running ? '一時停止' : '再開'}</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => setTimer(null)}>
          <Text style={styles.iconButtonText}>閉じる</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HomeScreen({
  activeWorkout,
  completedWorkouts,
  stats,
  onStart,
  onResume,
}: {
  activeWorkout: Workout | null;
  completedWorkouts: Workout[];
  stats: { completedSetCount: number; totalVolume: number; totalReps: number };
  onStart: () => void;
  onResume: () => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>今日の記録を始める</Text>
        <Text style={styles.heroText}>セットを追加した瞬間から保存します。閉じても、あとで続きから再開できます。</Text>
        <Pressable style={styles.primaryButton} onPress={activeWorkout ? onResume : onStart}>
          <Text style={styles.primaryButtonText}>{activeWorkout ? '途中の記録を再開' : 'ワークアウト開始'}</Text>
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <Metric label="保存済みセット" value={`${stats.completedSetCount}`} />
        <Metric label="総ボリューム" value={`${Math.round(stats.totalVolume).toLocaleString()}kg`} />
        <Metric label="総レップ" value={`${stats.totalReps}`} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>前回の記録</Text>
        {completedWorkouts[0] ? (
          <Text style={styles.panelText}>{completedWorkouts[0].performedAt} のワークアウトを保存済み</Text>
        ) : (
          <Text style={styles.muted}>まだ完了したワークアウトはありません。</Text>
        )}
      </View>
    </View>
  );
}

function WorkoutScreen({
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

  const activeSetCount = visibleSets.filter((set) => workoutExercises.some((item) => item.id === set.workoutExerciseId)).length;
  const activeVolume = visibleSets
    .filter((set) => workoutExercises.some((item) => item.id === set.workoutExerciseId))
    .reduce((sum, set) => sum + set.weightKg * set.reps, 0);

  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.sectionTitle}>今日のワークアウト</Text>
            <Text style={styles.muted}>最終保存 {new Date(activeWorkout.lastSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</Text>
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
              <Pressable key={exercise.id} style={styles.exerciseChip} onPress={() => onAddExercise(exercise)}>
                <Text style={styles.exerciseChipText}>{exercise.name}</Text>
                <Text style={styles.exerciseChipSub}>{bodyPart?.name ?? '未分類'} / {formatTimer(exercise.defaultRestSeconds)}</Text>
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

function WorkoutExerciseList({
  workoutExercises,
  visibleSets,
  exerciseById,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
  showTimer,
}: {
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  showTimer: boolean;
}) {
  return (
    <>
      {workoutExercises.map((workoutExercise) => {
        const exercise = exerciseById.get(workoutExercise.exerciseId);
        const sets = visibleSets.filter((set) => set.workoutExerciseId === workoutExercise.id).sort((a, b) => a.orderIndex - b.orderIndex);
        const volume = sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
        const bestOneRepMax = sets.reduce((best, set) => Math.max(best, estimateOneRepMax(set.weightKg, set.reps)), 0);
        const restSeconds = workoutExercise.restSecondsOverride ?? exercise?.defaultRestSeconds ?? 120;
        return (
          <View key={workoutExercise.id} style={styles.panel}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.exerciseTitle}>{exercise?.name ?? '種目'}</Text>
                <Text style={styles.muted}>{sets.length} セット / {Math.round(volume).toLocaleString()}kg / 推定1RM {bestOneRepMax}kg</Text>
              </View>
              <Pressable style={styles.smallButton} onPress={() => onAddSet(workoutExercise)}>
                <Text style={styles.smallButtonText}>+ セット</Text>
              </Pressable>
            </View>
            {showTimer ? (
              <Pressable
                style={styles.restRow}
                onPress={() => exercise && onOpenRestPicker(exercise.id, restSeconds)}
              >
                <Text style={styles.muted}>休憩タイマー</Text>
                <Text style={styles.restValue}>{formatTimer(restSeconds)} ›</Text>
              </Pressable>
            ) : null}
            {sets.length === 0 ? <Text style={styles.muted}>セットを追加すると、すぐ保存されます。</Text> : null}
            {sets.map((set) => (
              <SetEditor
                key={set.id}
                set={set}
                workoutExercise={workoutExercise}
                onPatchSet={onPatchSet}
                onStartRestTimer={onStartRestTimer}
                showTimer={showTimer}
              />
            ))}
          </View>
        );
      })}
    </>
  );
}

function SetEditor({
  set,
  workoutExercise,
  onPatchSet,
  onStartRestTimer,
  showTimer,
}: {
  set: WorkoutSet;
  workoutExercise: WorkoutExercise;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  showTimer: boolean;
}) {
  return (
    <View style={[styles.setCard, set.isCompleted && styles.completedSetCard]}>
      <View style={styles.rowBetween}>
        <Text style={styles.setTitle}>Set {set.orderIndex}</Text>
        <View style={styles.setActions}>
          <Pressable style={[styles.pill, set.isWarmup && styles.activePill]} onPress={() => onPatchSet(set.id, { isWarmup: !set.isWarmup })}>
            <Text style={[styles.pillText, set.isWarmup && styles.activePillText]}>WU</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={() => onPatchSet(set.id, { deletedAt: nowIso() })}>
            <Text style={styles.deleteButtonText}>削除</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.inputGrid}>
        <LabeledNumber label="重量" value={set.weightKg} suffix="kg" onChange={(value) => onPatchSet(set.id, { weightKg: value })} />
        <LabeledNumber label="回数" value={set.reps} suffix="回" onChange={(value) => onPatchSet(set.id, { reps: Math.max(0, Math.round(value)) })} />
        <LabeledNumber label="RPE" value={set.rpe} suffix="" onChange={(value) => onPatchSet(set.id, { rpe: value })} />
      </View>
      <TextInput
        value={set.memo}
        onChangeText={(memo) => onPatchSet(set.id, { memo })}
        placeholder="メモ"
        placeholderTextColor="#7a7f8a"
        style={styles.memoInput}
      />
      <View style={styles.rowBetween}>
        <Text style={styles.muted}>推定1RM {estimateOneRepMax(set.weightKg, set.reps)}kg</Text>
        {showTimer ? (
          <Pressable style={[styles.timerButton, set.isCompleted && styles.doneButton]} onPress={() => onStartRestTimer(set, workoutExercise)}>
            <Text style={styles.timerButtonText}>{set.isCompleted ? '再タイマー' : '完了+タイマー'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function LabeledNumber({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    onChange(parseNumber(draft, value));
  };

  const step = suffix === 'kg' ? 2.5 : 1;
  const updateByStep = (delta: number) => {
    const next = Math.max(0, value + delta);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <View style={styles.numberField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.numberRow}>
        <Pressable style={styles.stepButton} onPress={() => updateByStep(-step)}>
          <Text style={styles.stepButtonText}>-</Text>
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onEndEditing={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          style={styles.numberInput}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        <Pressable style={styles.stepButton} onPress={() => updateByStep(step)}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HistoryScreen({
  workouts,
  workoutExercises,
  visibleSets,
  exerciseById,
  editingWorkoutId,
  onEdit,
  onStopEdit,
  onAddSet,
  onPatchSet,
  onStartRestTimer,
  onOpenRestPicker,
  onDeleteWorkout,
}: {
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  editingWorkoutId: string | null;
  onEdit: (workoutId: string) => void;
  onStopEdit: () => void;
  onAddSet: (workoutExercise: WorkoutExercise) => void;
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onStartRestTimer: (set: WorkoutSet, workoutExercise: WorkoutExercise) => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  onDeleteWorkout: (workoutId: string) => void;
}) {
  const confirmDelete = (workoutId: string, label: string) => {
    Alert.alert('記録を削除', `${label} の記録を削除します。元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDeleteWorkout(workoutId) },
    ]);
  };

  return (
    <View style={styles.stack}>
      <Text style={styles.pageTitle}>履歴</Text>
      {workouts.length === 0 ? <Text style={styles.muted}>完了したワークアウトはまだありません。</Text> : null}
      {workouts.map((workout) => {
        const items = workoutExercises
          .filter((item) => item.workoutId === workout.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);
        const sets = visibleSets.filter((set) => items.some((item) => item.id === set.workoutExerciseId));
        const totalVolume = sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
        const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
        const isEditing = editingWorkoutId === workout.id;
        return (
          <View key={workout.id} style={styles.panel}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>{workout.performedAt}</Text>
              {isEditing ? (
                <Pressable style={styles.secondaryButton} onPress={onStopEdit}>
                  <Text style={styles.secondaryButtonText}>編集を終了</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.ghostButton} onPress={() => onEdit(workout.id)}>
                  <Text style={styles.ghostButtonText}>編集</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.metricGrid}>
              <Metric label="種目" value={`${items.length}`} />
              <Metric label="セット" value={`${sets.length}`} />
              <Metric label="総レップ" value={`${totalReps}`} />
              <Metric label="ボリューム" value={`${Math.round(totalVolume).toLocaleString()}kg`} />
            </View>
            {isEditing ? (
              <>
                <WorkoutExerciseList
                  workoutExercises={items}
                  visibleSets={visibleSets}
                  exerciseById={exerciseById}
                  onAddSet={onAddSet}
                  onPatchSet={onPatchSet}
                  onStartRestTimer={onStartRestTimer}
                  onOpenRestPicker={onOpenRestPicker}
                  showTimer={false}
                />
                <Pressable style={styles.dangerButton} onPress={() => confirmDelete(workout.id, workout.performedAt)}>
                  <Text style={styles.dangerButtonText}>この記録を削除</Text>
                </Pressable>
              </>
            ) : (
              items.map((item) => {
                const exercise = exerciseById.get(item.exerciseId);
                const itemSets = sets.filter((set) => set.workoutExerciseId === item.id);
                const best = itemSets.reduce((max, set) => Math.max(max, estimateOneRepMax(set.weightKg, set.reps)), 0);
                return (
                  <View key={item.id} style={styles.historyItem}>
                    <Text style={styles.historyTitle}>{exercise?.name ?? '種目'}</Text>
                    <Text style={styles.muted}>
                      {itemSets.length} セット / 推定1RM {best}kg / {itemSets.map((set) => `${set.weightKg}kgx${set.reps}`).join(', ')}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );
}

function ExerciseScreen({
  bodyParts,
  exercises,
  bodyPartById,
  newExerciseName,
  onChangeNewExerciseName,
  onAddCustomExercise,
  onOpenRestPicker,
}: {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  bodyPartById: Map<string, BodyPart>;
  newExerciseName: string;
  onChangeNewExerciseName: (value: string) => void;
  onAddCustomExercise: () => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>種目を追加</Text>
        <TextInput
          value={newExerciseName}
          onChangeText={onChangeNewExerciseName}
          placeholder="例: インクラインダンベルプレス"
          placeholderTextColor="#7a7f8a"
          style={styles.textInput}
        />
        <Pressable style={styles.primaryButton} onPress={onAddCustomExercise}>
          <Text style={styles.primaryButtonText}>種目を登録</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>部位マスター</Text>
        <View style={styles.chipWrap}>
          {bodyParts.map((part) => (
            <View key={part.id} style={styles.staticChip}>
              <Text style={styles.staticChipText}>{part.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {exercises.map((exercise) => {
        const bodyPart = bodyPartById.get(exercise.primaryBodyPartId);
        return (
          <View key={exercise.id} style={styles.panel}>
            <Text style={styles.exerciseTitle}>{exercise.name}</Text>
            <Text style={styles.muted}>{bodyPart?.name ?? '未分類'} / バー {exercise.defaultBarWeightKg}kg</Text>
            <Pressable style={styles.restRow} onPress={() => onOpenRestPicker(exercise.id, exercise.defaultRestSeconds)}>
              <Text style={styles.muted}>デフォルト休憩</Text>
              <Text style={styles.restValue}>{formatTimer(exercise.defaultRestSeconds)} ›</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function RestPickerModal({
  value,
  onConfirm,
  onCancel,
}: {
  value: number;
  onConfirm: (seconds: number) => void;
  onCancel: () => void;
}) {
  const [minutes, setMinutes] = useState(Math.floor(value / 60));
  const [seconds, setSeconds] = useState(Math.round((value % 60) / 5) * 5);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.sectionTitle}>休憩タイマー</Text>
          <Text style={styles.muted}>セット完了後に使う休憩時間です。</Text>
          <View style={styles.pickerRow}>
            <Picker
              selectedValue={minutes}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              onValueChange={(next) => setMinutes(Number(next))}
            >
              {Array.from({ length: 16 }, (_, index) => index).map((minute) => (
                <Picker.Item key={minute} label={`${minute}`} value={minute} color="#f4f7fb" />
              ))}
            </Picker>
            <Text style={styles.pickerUnit}>分</Text>
            <Picker
              selectedValue={seconds}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              onValueChange={(next) => setSeconds(Number(next))}
            >
              {Array.from({ length: 12 }, (_, index) => index * 5).map((second) => (
                <Picker.Item key={second} label={`${second.toString().padStart(2, '0')}`} value={second} color="#f4f7fb" />
              ))}
            </Picker>
            <Text style={styles.pickerUnit}>秒</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.ghostButton} onPress={onCancel}>
              <Text style={styles.ghostButtonText}>キャンセル</Text>
            </Pressable>
            <Pressable style={styles.primaryButtonFlat} onPress={() => onConfirm(minutes * 60 + seconds)}>
              <Text style={styles.primaryButtonText}>決定</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#101419',
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appName: {
    color: '#f4f7fb',
    fontSize: 25,
    fontWeight: '800',
  },
  headerSub: {
    color: '#a7b0bd',
    marginTop: 4,
    fontSize: 12,
  },
  badge: {
    backgroundColor: '#243d3b',
    borderColor: '#37c9a5',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    color: '#8af2d1',
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: '#1a2028',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a3340',
  },
  activeTab: {
    backgroundColor: '#263748',
    borderColor: '#61a8ff',
  },
  tabText: {
    color: '#aeb7c4',
    fontWeight: '700',
  },
  activeTabText: {
    color: '#f4f7fb',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 14,
    paddingBottom: 40,
  },
  stack: {
    gap: 12,
  },
  title: {
    color: '#f4f7fb',
    fontSize: 24,
    fontWeight: '800',
  },
  pageTitle: {
    color: '#f4f7fb',
    fontSize: 22,
    fontWeight: '800',
  },
  hero: {
    backgroundColor: '#18222e',
    borderColor: '#2f6d79',
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
  },
  heroTitle: {
    color: '#f4f7fb',
    fontSize: 24,
    fontWeight: '800',
  },
  heroText: {
    color: '#b7c3d1',
    marginTop: 8,
    lineHeight: 20,
  },
  panel: {
    backgroundColor: '#171d25',
    borderColor: '#2c3643',
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  panelText: {
    color: '#dce5ef',
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#f4f7fb',
    fontSize: 18,
    fontWeight: '800',
  },
  exerciseTitle: {
    color: '#f4f7fb',
    fontSize: 17,
    fontWeight: '800',
  },
  muted: {
    color: '#9aa6b5',
    lineHeight: 19,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metric: {
    minWidth: '22%',
    flexGrow: 1,
    backgroundColor: '#101820',
    borderColor: '#2b3644',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  metricValue: {
    color: '#f4f7fb',
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#8f9cab',
    marginTop: 3,
    fontSize: 12,
  },
  primaryButton: {
    backgroundColor: '#2d7df0',
    minHeight: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#244135',
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#40c987',
  },
  secondaryButtonText: {
    color: '#94f1bd',
    fontWeight: '800',
  },
  smallButton: {
    backgroundColor: '#2d7df0',
    minHeight: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  smallButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseChip: {
    width: '48%',
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#354254',
    backgroundColor: '#111922',
    padding: 10,
    justifyContent: 'center',
  },
  exerciseChipText: {
    color: '#f4f7fb',
    fontWeight: '800',
  },
  exerciseChipSub: {
    color: '#8f9cab',
    marginTop: 4,
    fontSize: 12,
  },
  staticChip: {
    backgroundColor: '#22303e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  staticChipText: {
    color: '#dce5ef',
    fontWeight: '700',
  },
  setCard: {
    backgroundColor: '#101820',
    borderColor: '#2b3644',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  completedSetCard: {
    borderColor: '#3b7b68',
  },
  setTitle: {
    color: '#f4f7fb',
    fontWeight: '800',
  },
  setActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    borderColor: '#3a4656',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activePill: {
    backgroundColor: '#4b3c18',
    borderColor: '#f5c048',
  },
  pillText: {
    color: '#aeb7c4',
    fontWeight: '800',
  },
  activePillText: {
    color: '#ffe09b',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deleteButtonText: {
    color: '#ff8a8a',
    fontWeight: '800',
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  numberField: {
    width: '48%',
    backgroundColor: '#171f29',
    borderRadius: 8,
    borderColor: '#2d3847',
    borderWidth: 1,
    padding: 9,
  },
  inputLabel: {
    color: '#8f9cab',
    fontSize: 12,
    fontWeight: '700',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  numberInput: {
    color: '#f4f7fb',
    fontSize: 18,
    fontWeight: '800',
    minHeight: 34,
    flex: 1,
    padding: 0,
    textAlign: 'center',
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#263748',
  },
  stepButtonText: {
    color: '#f4f7fb',
    fontWeight: '900',
    fontSize: 16,
  },
  suffix: {
    color: '#8f9cab',
    fontWeight: '700',
  },
  memoInput: {
    color: '#f4f7fb',
    minHeight: 42,
    backgroundColor: '#171f29',
    borderRadius: 8,
    borderColor: '#2d3847',
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  textInput: {
    color: '#f4f7fb',
    minHeight: 46,
    backgroundColor: '#101820',
    borderRadius: 8,
    borderColor: '#2d3847',
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  timerButton: {
    backgroundColor: '#4d3d17',
    minHeight: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dba233',
  },
  doneButton: {
    backgroundColor: '#214238',
    borderColor: '#49d19a',
  },
  timerButtonText: {
    color: '#fff0c7',
    fontWeight: '800',
  },
  timerBanner: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dba233',
    backgroundColor: '#2a2519',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timerFinished: {
    borderColor: '#49d19a',
    backgroundColor: '#162820',
  },
  timerLabel: {
    color: '#9aa6b5',
    fontSize: 12,
    fontWeight: '800',
  },
  timerTitle: {
    color: '#f4f7fb',
    fontWeight: '800',
    marginTop: 2,
  },
  timerTime: {
    color: '#f4f7fb',
    fontSize: 24,
    fontWeight: '900',
  },
  timerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    borderColor: '#465466',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  iconButtonText: {
    color: '#dce5ef',
    fontWeight: '800',
    fontSize: 12,
  },
  historyItem: {
    borderTopColor: '#2b3644',
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 4,
  },
  historyTitle: {
    color: '#f4f7fb',
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ghostButton: {
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#3a4656',
    backgroundColor: '#1a2230',
  },
  ghostButtonText: {
    color: '#cdd6e3',
    fontWeight: '800',
  },
  restRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#101820',
    borderColor: '#2b3644',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  restValue: {
    color: '#ffe09b',
    fontWeight: '800',
    fontSize: 16,
  },
  dangerButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#7a2f33',
    backgroundColor: '#2a1618',
  },
  dangerButtonText: {
    color: '#ff8a8a',
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 9, 13, 0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#171d25',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderColor: '#2c3643',
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  picker: {
    flex: 1,
    color: '#f4f7fb',
  },
  pickerItem: {
    color: '#f4f7fb',
    fontSize: 22,
  },
  pickerUnit: {
    color: '#aeb7c4',
    fontWeight: '800',
    fontSize: 16,
  },
  primaryButtonFlat: {
    backgroundColor: '#2d7df0',
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
});
