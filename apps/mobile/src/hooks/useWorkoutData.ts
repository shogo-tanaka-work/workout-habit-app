import { setAudioModeAsync } from 'expo-audio';
import * as SQLite from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { runMigrations } from '../db/migrations';
import { seedMasters } from '../db/seed';
import {
  deleteTemplateDeep,
  deleteWorkoutDeep,
  findActiveWorkoutRow,
  insertExercise,
  insertTemplateDeep,
  insertTimerEvent,
  insertWorkout,
  insertWorkoutExercise,
  insertWorkoutSet,
  loadWorkoutData,
  markLastBackupAt,
  setExerciseRest,
  setWorkoutStatus,
  touchWorkout,
  updateWorkoutSet,
  upsertBodyLog,
  upsertSyncConnection,
  upsertTimerSettings,
} from '../db/queries';
import {
  applyBackupPayload,
  exportBackupPayload,
  fetchBackupFromCloud,
  pushBackupToCloud,
} from '../db/sync';
import type {
  BodyLog,
  BodyPart,
  Exercise,
  SetPatch,
  SyncSettings,
  Template,
  TemplateExercise,
  TimerSettings,
  TimerState,
  WeeklyStats,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import type { BodyPartSummary } from '../utils/aggregate';
import { summarizeByBodyPart } from '../utils/aggregate';
import { formatDate, nowIso, startOfWeekIso } from '../utils/datetime';
import { newId } from '../utils/id';

// SQLite の初期化・データ読み込み・全 CRUD 操作・派生状態を集約するフック。
// UI（タブ・編集中ID・入力欄など）の状態は持たず、App 側が管理する。
export function useWorkoutData() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    soundEnabled: true,
    vibrationEnabled: true,
  });
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    apiUrl: '',
    apiToken: '',
    lastBackupAt: null,
  });

  const activeWorkout = useMemo(
    () => workouts.find((workout) => workout.status === 'active') ?? null,
    [workouts],
  );

  const visibleSets = useMemo(
    () => workoutSets.filter((set) => set.deletedAt === null),
    [workoutSets],
  );

  const exerciseById = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
  const bodyPartById = useMemo(
    () => new Map(bodyParts.map((bodyPart) => [bodyPart.id, bodyPart])),
    [bodyParts],
  );
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
    () =>
      workouts
        .filter((workout) => workout.status === 'completed')
        .sort((a, b) => b.performedAt.localeCompare(a.performedAt)),
    [workouts],
  );

  // ホーム表示用の「今週（月曜はじまり）」の集計。
  const stats = useMemo((): WeeklyStats => {
    const weekStart = startOfWeekIso(new Date());
    const weekWorkouts = workouts.filter((workout) => workout.performedAt >= weekStart);
    const weekWorkoutIds = new Set(weekWorkouts.map((workout) => workout.id));
    const weekExerciseIds = new Set(
      workoutExercises.filter((item) => weekWorkoutIds.has(item.workoutId)).map((item) => item.id),
    );
    let setCount = 0;
    let totalVolume = 0;
    let totalReps = 0;
    for (const set of visibleSets) {
      if (!weekExerciseIds.has(set.workoutExerciseId)) {
        continue;
      }
      setCount += 1;
      totalVolume += set.weightKg * set.reps;
      totalReps += set.reps;
    }
    return { workoutCount: weekWorkouts.length, setCount, totalVolume, totalReps };
  }, [workouts, workoutExercises, visibleSets]);

  // ホーム表示用の「今週の部位別」集計（ボリューム降順）。
  const weeklyBodyPartSummary = useMemo((): BodyPartSummary[] => {
    const weekStart = startOfWeekIso(new Date());
    const weekWorkoutIds = new Set(
      workouts.filter((workout) => workout.performedAt >= weekStart).map((workout) => workout.id),
    );
    const weekExercises = workoutExercises.filter((item) => weekWorkoutIds.has(item.workoutId));
    const weekExerciseIds = new Set(weekExercises.map((item) => item.id));
    const weekSets = visibleSets.filter((set) => weekExerciseIds.has(set.workoutExerciseId));
    return summarizeByBodyPart(weekExercises, weekSets, exerciseById, bodyPartById);
  }, [workouts, workoutExercises, visibleSets, exerciseById, bodyPartById]);

  // 記録画面の種目追加用に、使用回数の多い順（同数は名前順）へ並べ替えた種目一覧。
  const exercisesByUsage = useMemo(() => {
    const usageCount = new Map<string, number>();
    for (const item of workoutExercises) {
      usageCount.set(item.exerciseId, (usageCount.get(item.exerciseId) ?? 0) + 1);
    }
    return [...exercises].sort((a, b) => {
      const countDiff = (usageCount.get(b.id) ?? 0) - (usageCount.get(a.id) ?? 0);
      return countDiff !== 0 ? countDiff : a.name.localeCompare(b.name, 'ja');
    });
  }, [exercises, workoutExercises]);

  const reloadData = useCallback(async (database: SQLite.SQLiteDatabase) => {
    const data = await loadWorkoutData(database);
    setBodyParts(data.bodyParts);
    setExercises(data.exercises);
    setWorkouts(data.workouts);
    setWorkoutExercises(data.workoutExercises);
    setWorkoutSets(data.workoutSets);
    setTemplates(data.templates);
    setTemplateExercises(data.templateExercises);
    setTimerSettings(data.timerSettings);
    setBodyLogs(data.bodyLogs);
    setSyncSettings(data.syncSettings);
  }, []);

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const database = await SQLite.openDatabaseAsync('workout-habit.db');
        // 参照整合性を効かせるため、接続ごとに有効化する（既定は OFF）。
        await database.execAsync('PRAGMA foreign_keys = ON');
        await runMigrations(database);
        await seedMasters(database);

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

  const ensureDb = (): SQLite.SQLiteDatabase => {
    if (!db) {
      throw new Error('データベースの準備がまだ終わっていません');
    }
    return db;
  };

  const startWorkout = async () => {
    const database = ensureDb();
    const existingActive = await findActiveWorkoutRow(database);
    if (existingActive) {
      await reloadData(database);
      return;
    }
    await insertWorkout(database, { id: newId('workout'), performedAt: formatDate(new Date()) });
    await reloadData(database);
  };

  const completeWorkout = async () => {
    if (!activeWorkout) {
      return;
    }
    const database = ensureDb();
    await setWorkoutStatus(database, activeWorkout.id, 'completed');
    await reloadData(database);
  };

  const pauseWorkout = async () => {
    if (activeWorkout) {
      await touchWorkout(ensureDb(), activeWorkout.id);
    }
  };

  const deleteWorkout = async (workoutId: string) => {
    const database = ensureDb();
    const items = workoutExercises.filter((item) => item.workoutId === workoutId);
    await deleteWorkoutDeep(
      database,
      workoutId,
      items.map((item) => item.id),
    );
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
    await insertWorkoutExercise(database, {
      id: newId('workout-exercise'),
      workoutId: workout.id,
      exerciseId: exercise.id,
      orderIndex: activeWorkoutExercises.length + 1,
    });
    await touchWorkout(database, workout.id);
    await reloadData(database);
  };

  const addSet = async (workoutExercise: WorkoutExercise) => {
    const database = ensureDb();
    const exercise = exerciseById.get(workoutExercise.exerciseId);
    const allSetsForExercise = workoutSets.filter(
      (set) => set.workoutExerciseId === workoutExercise.id,
    );
    const currentSets = allSetsForExercise.filter((set) => set.deletedAt === null);
    const previousSet = currentSets.at(-1);
    const nextOrderIndex =
      allSetsForExercise.reduce((max, set) => Math.max(max, set.orderIndex), 0) + 1;
    await insertWorkoutSet(database, {
      id: newId('set'),
      workoutExerciseId: workoutExercise.id,
      orderIndex: nextOrderIndex,
      weightKg: previousSet?.weightKg ?? exercise?.defaultBarWeightKg ?? 0,
      reps: previousSet?.reps ?? 8,
      rpe: previousSet?.rpe ?? 8,
      restSeconds: workoutExercise.restSecondsOverride ?? exercise?.defaultRestSeconds ?? 120,
    });
    if (workoutExercise.workoutId) {
      await touchWorkout(database, workoutExercise.workoutId);
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
    await updateWorkoutSet(database, next);
    const owningWorkoutId = workoutExerciseById.get(current.workoutExerciseId)?.workoutId;
    if (owningWorkoutId) {
      await touchWorkout(database, owningWorkoutId);
    }
    await reloadData(database);
  };

  // 休憩タイマーの開始。セットを完了扱いにし timer_events を記録、TimerState を返す。
  // 返した状態は呼び出し側（App）が useRestTimer の setTimer に渡す。
  const beginRestTimer = async (
    set: WorkoutSet,
    workoutExercise: WorkoutExercise,
  ): Promise<TimerState> => {
    const database = ensureDb();
    const exercise = exerciseById.get(workoutExercise.exerciseId);
    const duration = Math.max(
      1,
      workoutExercise.restSecondsOverride ?? exercise?.defaultRestSeconds ?? set.restSeconds ?? 120,
    );
    await patchSet(set.id, { isCompleted: true, restSeconds: duration });
    await insertTimerEvent(database, {
      id: newId('timer'),
      workoutSetId: set.id,
      exerciseId: workoutExercise.exerciseId,
      durationSeconds: duration,
    });
    return {
      workoutSetId: set.id,
      exerciseName: exercise?.name ?? '種目',
      duration,
      remaining: duration,
      running: true,
      finished: false,
      endsAt: Date.now() + duration * 1000,
    };
  };

  // カスタム種目の追加。空文字なら何もせず false を返す（呼び出し側の入力クリア判断に使う）。
  const addCustomExercise = async (rawName: string): Promise<boolean> => {
    const name = rawName.trim();
    if (!name) {
      return false;
    }
    const database = ensureDb();
    await insertExercise(database, {
      id: newId('exercise'),
      name,
      primaryBodyPartId: bodyParts[0]?.id ?? 'chest',
    });
    await reloadData(database);
    return true;
  };

  const updateExerciseRest = async (exercise: Exercise, restSeconds: number) => {
    const database = ensureDb();
    await setExerciseRest(database, exercise.id, restSeconds);
    await reloadData(database);
  };

  // 記録中のワークアウトの種目並びをテンプレートとして保存する。
  // 名前が空・種目ゼロなら何もせず false を返す。
  const saveActiveWorkoutAsTemplate = async (rawName: string): Promise<boolean> => {
    const name = rawName.trim();
    if (!name || activeWorkoutExercises.length === 0) {
      return false;
    }
    const database = ensureDb();
    await insertTemplateDeep(database, {
      id: newId('template'),
      name,
      exerciseEntries: activeWorkoutExercises.map((item) => ({
        id: newId('template-exercise'),
        exerciseId: item.exerciseId,
      })),
    });
    await reloadData(database);
    return true;
  };

  // テンプレートからワークアウトを開始する（種目をまとめて追加）。
  const startWorkoutFromTemplate = async (template: Template) => {
    const database = ensureDb();
    const existingActive = await findActiveWorkoutRow(database);
    if (existingActive) {
      Alert.alert('記録中のワークアウトがあります', '先に完了するか、再開してください。');
      await reloadData(database);
      return;
    }
    const workoutId = newId('workout');
    await insertWorkout(database, { id: workoutId, performedAt: formatDate(new Date()) });
    const entries = templateExercises
      .filter((item) => item.templateId === template.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    for (const [index, entry] of entries.entries()) {
      await insertWorkoutExercise(database, {
        id: newId('workout-exercise'),
        workoutId,
        exerciseId: entry.exerciseId,
        orderIndex: index + 1,
      });
    }
    await reloadData(database);
  };

  const deleteTemplate = async (templateId: string) => {
    const database = ensureDb();
    await deleteTemplateDeep(database, templateId);
    await reloadData(database);
  };

  // タイマー設定（音・振動）を保存し、即座に state へ反映する。
  const updateTimerSettings = async (settings: TimerSettings) => {
    await upsertTimerSettings(ensureDb(), settings);
    setTimerSettings(settings);
  };

  // クラウドバックアップの接続設定（URL・トークン）を保存する。
  const updateSyncConnection = async (apiUrl: string, apiToken: string) => {
    const database = ensureDb();
    await upsertSyncConnection(database, { apiUrl: apiUrl.trim(), apiToken: apiToken.trim() });
    setSyncSettings((previous) => ({
      ...previous,
      apiUrl: apiUrl.trim(),
      apiToken: apiToken.trim(),
    }));
  };

  const ensureSyncConnection = (): SyncSettings => {
    if (!syncSettings.apiUrl || !syncSettings.apiToken) {
      throw new Error('API URLとトークンを設定してください');
    }
    return syncSettings;
  };

  // ローカル全データをクラウドへバックアップする（クラウド側は全置き換え）。
  const backupToCloud = async () => {
    const database = ensureDb();
    const connection = ensureSyncConnection();
    const payload = await exportBackupPayload(database);
    await pushBackupToCloud(connection.apiUrl, connection.apiToken, payload);
    const timestamp = nowIso();
    await markLastBackupAt(database, timestamp);
    setSyncSettings((previous) => ({ ...previous, lastBackupAt: timestamp }));
  };

  // クラウドのバックアップでローカルを置き換える（復元）。呼び出し側で確認ダイアログを出す。
  const restoreFromCloud = async () => {
    const database = ensureDb();
    const connection = ensureSyncConnection();
    const payload = await fetchBackupFromCloud(connection.apiUrl, connection.apiToken);
    await applyBackupPayload(database, payload);
    await reloadData(database);
  };

  // 今日のボディログを保存する（同日があれば上書き）。体重 0 以下は無効として false。
  const saveBodyLog = async (
    bodyWeightKg: number,
    bodyFatPercentage: number | null,
  ): Promise<boolean> => {
    if (bodyWeightKg <= 0) {
      return false;
    }
    const database = ensureDb();
    await upsertBodyLog(database, {
      id: newId('body-log'),
      measuredAt: formatDate(new Date()),
      bodyWeightKg,
      bodyFatPercentage: bodyFatPercentage && bodyFatPercentage > 0 ? bodyFatPercentage : null,
    });
    await reloadData(database);
    return true;
  };

  return {
    isReady,
    errorMessage,
    bodyParts,
    exercises,
    workouts,
    workoutExercises,
    workoutSets,
    activeWorkout,
    visibleSets,
    exerciseById,
    bodyPartById,
    activeWorkoutExercises,
    completedWorkouts,
    stats,
    weeklyBodyPartSummary,
    exercisesByUsage,
    templates,
    templateExercises,
    timerSettings,
    bodyLogs,
    saveActiveWorkoutAsTemplate,
    startWorkoutFromTemplate,
    deleteTemplate,
    updateTimerSettings,
    saveBodyLog,
    syncSettings,
    updateSyncConnection,
    backupToCloud,
    restoreFromCloud,
    startWorkout,
    completeWorkout,
    pauseWorkout,
    deleteWorkout,
    addExerciseToWorkout,
    addSet,
    patchSet,
    beginRestTimer,
    addCustomExercise,
    updateExerciseRest,
  };
}
