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
  setSyncPaused,
  setWorkoutStatus,
  startPlannedWorkout,
  touchWorkout,
  updateWorkoutSet,
  upsertBodyLog,
  upsertSyncConnection,
  upsertTimerSettings,
} from '../db/queries';
import type { GoogleAccount } from '../auth/googleAuth';
import {
  getIdToken,
  isGoogleSignInConfigured,
  restoreAccount,
  signIn as signInWithGoogle,
  signOut as signOutFromGoogle,
} from '../auth/googleAuth';
import { countPendingOperations } from '../db/outbox';
import { fetchPlansFromCloud, replacePlannedWorkouts } from '../db/plans';
import { applyBackupPayload, fetchBackupFromCloud } from '../db/sync';
import { pushPendingOperations } from '../sync/pusher';
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
import { formatDate, isoDatePlusDays, nowIso, nowMs, startOfWeekIso } from '../utils/datetime';
import { newId } from '../utils/id';

// 未送信が残っているときの再送間隔。短すぎると圏外で無駄な試行を繰り返す。
const SYNC_RETRY_INTERVAL_MS = 60_000;

// 予定を取り込む期間。過去は取りこぼした予定を拾える程度に、先は数週間分だけ見る。
const PLAN_RANGE_DAYS_BACK = 7;
const PLAN_RANGE_DAYS_AHEAD = 28;

const planRange = (): { from: string; to: string } => {
  const today = formatDate(new Date());
  return {
    from: isoDatePlusDays(today, -PLAN_RANGE_DAYS_BACK),
    to: isoDatePlusDays(today, PLAN_RANGE_DAYS_AHEAD),
  };
};

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
    lastBackupAt: null,
    isPaused: false,
  });
  // ログイン中の Google アカウント。トークンは保持せず、必要になった時点で取り直す。
  const [account, setAccount] = useState<GoogleAccount | null>(null);
  // 送信待ちの操作数。ヘッダの控えめな表示に使う（機内モードのような概念は見せない）。
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const activeWorkout = useMemo(
    () => workouts.find((workout) => workout.status === 'active') ?? null,
    [workouts],
  );

  const visibleSets = useMemo(
    () => workoutSets.filter((set) => set.deletedAt === null),
    [workoutSets],
  );

  // 論理削除済みのセット。戻す導線に使う（削除しても取り返しがつくようにするため）。
  const deletedSets = useMemo(
    () => workoutSets.filter((set) => set.deletedAt !== null),
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

  // Claude Code が書いた予定のうち、まだ実施していないもの（日付の早い順）。
  const plannedWorkouts = useMemo(
    () =>
      workouts
        .filter((workout) => workout.status === 'planned')
        .sort((a, b) => a.performedAt.localeCompare(b.performedAt)),
    [workouts],
  );

  // 実績だけを集計対象にする。予定のセットは「やっていない記録」なので、
  // 混ぜるとボリュームも回数も水増しされる。
  const performedWorkouts = useMemo(
    () => workouts.filter((workout) => workout.status !== 'planned'),
    [workouts],
  );

  // ホーム表示用の「今週（月曜はじまり）」の集計。
  const stats = useMemo((): WeeklyStats => {
    const weekStart = startOfWeekIso(new Date());
    const weekWorkouts = performedWorkouts.filter((workout) => workout.performedAt >= weekStart);
    const weekWorkoutIds = new Set(weekWorkouts.map((workout) => workout.id));
    const weekExerciseIds = new Set(
      workoutExercises.filter((item) => weekWorkoutIds.has(item.workoutId)).map((item) => item.id),
    );
    let setCount = 0;
    let totalVolume = 0;
    let totalReps = 0;
    for (const set of visibleSets) {
      // ウォームアップは集計に入れない（utils/aggregate.ts と同じ規則）。
      if (set.isWarmup || !weekExerciseIds.has(set.workoutExerciseId)) {
        continue;
      }
      setCount += 1;
      totalVolume += set.weightKg * set.reps;
      totalReps += set.reps;
    }
    return { workoutCount: weekWorkouts.length, setCount, totalVolume, totalReps };
  }, [performedWorkouts, workoutExercises, visibleSets]);

  // ホーム表示用の「今週の部位別」集計（ボリューム降順）。
  const weeklyBodyPartSummary = useMemo((): BodyPartSummary[] => {
    const weekStart = startOfWeekIso(new Date());
    const weekWorkoutIds = new Set(
      performedWorkouts
        .filter((workout) => workout.performedAt >= weekStart)
        .map((workout) => workout.id),
    );
    const weekExercises = workoutExercises.filter((item) => weekWorkoutIds.has(item.workoutId));
    const weekExerciseIds = new Set(weekExercises.map((item) => item.id));
    const weekSets = visibleSets.filter((set) => weekExerciseIds.has(set.workoutExerciseId));
    return summarizeByBodyPart(weekExercises, weekSets, exerciseById, bodyPartById);
  }, [performedWorkouts, workoutExercises, visibleSets, exerciseById, bodyPartById]);

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
    setPendingSyncCount(await countPendingOperations(database));
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

        // ログイン状態はネイティブ SDK が保持している。復元できなければ未ログインのまま進む
        // （記録・閲覧・タイマーはログイン不要で動く）。
        const restored = await restoreAccount();

        if (mounted) {
          setDb(database);
          setAccount(restored);
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
    void syncInBackground();
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
      // RPE は入力欄から外している。既定は 0（実績データもすべて 0）。
      rpe: previousSet?.rpe ?? 0,
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

    // 送信の契機は「その種目の全セットが完了したとき」。
    // 1操作ごとに送ると通信が多すぎるため、種目が終わるまでキューに溜める。
    const setsOfExercise = workoutSets.filter(
      (set) => set.workoutExerciseId === current.workoutExerciseId && set.deletedAt === null,
    );
    const exerciseFinished =
      setsOfExercise.length > 0 &&
      setsOfExercise.every((set) => (set.id === setId ? next : set).isCompleted);
    if (exerciseFinished) {
      void syncInBackground();
    }
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
      endsAt: nowMs() + duration * 1000,
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

  // サーバの接続先を保存する。認証情報は端末に置かない。
  const updateSyncConnection = async (apiUrl: string) => {
    const database = ensureDb();
    await upsertSyncConnection(database, { apiUrl: apiUrl.trim() });
    setSyncSettings((previous) => ({ ...previous, apiUrl: apiUrl.trim() }));
  };

  const ensureSyncConnection = (): SyncSettings => {
    if (!syncSettings.apiUrl) {
      throw new Error('API URLを設定してください');
    }
    if (!account) {
      throw new Error('Google アカウントでログインしてください');
    }
    return syncSettings;
  };

  // Google サインイン。成功したらアカウントを保持し、溜まった操作を送る。
  const signInToGoogle = async (): Promise<void> => {
    const signedIn = await signInWithGoogle();
    if (!signedIn) {
      return;
    }
    setAccount(signedIn);
    // ログイン前に溜まっていた操作をここで送る（オンライン復帰と同じ扱い）。
    void syncInBackground();
  };

  const signOutOfGoogle = async (): Promise<void> => {
    await signOutFromGoogle();
    setAccount(null);
  };

  // 送信待ちの操作をサーバへ送る。手動の「今すぐ同期」から呼ぶ。
  const syncNow = async () => {
    const database = ensureDb();
    const connection = ensureSyncConnection();
    const result = await pushPendingOperations(database, {
      apiUrl: connection.apiUrl,
      getIdToken,
    });
    setPendingSyncCount(result.pending);
    if (result.settled > 0) {
      const timestamp = nowIso();
      await markLastBackupAt(database, timestamp);
      setSyncSettings((previous) => ({ ...previous, lastBackupAt: timestamp }));
    }
    if (result.failed > 0) {
      throw new Error(`${result.failed}件の操作がサーバに拒否されました`);
    }
  };

  // 自動送信の一時停止。**送信役だけを止める**ので、記録の保存処理は1実装のまま。
  // ローミング中や通信量を抑えたいときに使う。手動の「今すぐ同期」は止めない
  // （止めると、送り忘れた分が端末にしか存在しない状態を自分で作ることになる）。
  const updateSyncPaused = async (isPaused: boolean): Promise<void> => {
    const database = ensureDb();
    await setSyncPaused(database, isPaused);
    setSyncSettings((previous) => ({ ...previous, isPaused }));
  };

  // 自動送信。契機（種目の全セット完了・ワークアウト完了・バックグラウンド遷移）から呼ぶ。
  // 失敗しても画面は止めない。積まれたまま次の契機で再送する。
  const syncInBackground = useCallback(async () => {
    if (!db || !syncSettings.apiUrl || !account || syncSettings.isPaused) {
      return;
    }
    try {
      const result = await pushPendingOperations(db, {
        apiUrl: syncSettings.apiUrl,
        getIdToken,
      });
      setPendingSyncCount(result.pending);
    } catch (error: unknown) {
      console.warn('[sync] 自動送信に失敗', error instanceof Error ? error.message : String(error));
      setPendingSyncCount(await countPendingOperations(db));
    }
  }, [db, syncSettings.apiUrl, account, syncSettings.isPaused]);

  // 未送信が残っている間だけ定期的に再送する。
  //
  // 他の契機（種目の完了・アプリの復帰・バックグラウンド遷移）はどれも操作か画面遷移が要る。
  // アプリを開いたまま通信が一時的に失敗すると、**次に画面を離れるまで送信されない**。
  // 定期リトライがあれば、その状態を利用者が気付かないうちに吸収できる。
  //
  // 未送信が 0 になればタイマーは張り直されない（常駐させない）。
  useEffect(() => {
    if (pendingSyncCount === 0) {
      return;
    }
    const timer = setInterval(() => void syncInBackground(), SYNC_RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pendingSyncCount, syncInBackground]);

  // 予定の取り込み。**受信なので outbox には積まない**（src/db/plans.ts）。
  // 送信と違い、失敗しても端末には何も残らない。次の契機で取り直せばよい。
  const importPlansInBackground = useCallback(async () => {
    // 一時停止は通信量を抑えるための設定なので、受信も止める。手動の取り込みは止めない。
    if (!db || !syncSettings.apiUrl || !account || syncSettings.isPaused) {
      return;
    }
    try {
      const { from, to } = planRange();
      const payload = await fetchPlansFromCloud(syncSettings.apiUrl, await getIdToken(), from, to);
      await replacePlannedWorkouts(db, payload);
      await reloadData(db);
    } catch (error: unknown) {
      console.warn(
        '[plans] 予定の取り込みに失敗',
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [db, syncSettings.apiUrl, account, syncSettings.isPaused, reloadData]);

  // 手動の取り込み。失敗を画面へ伝えたいので、こちらは例外を投げる。
  const importPlans = async (): Promise<void> => {
    const database = ensureDb();
    const connection = ensureSyncConnection();
    const { from, to } = planRange();
    const payload = await fetchPlansFromCloud(connection.apiUrl, await getIdToken(), from, to);
    await replacePlannedWorkouts(database, payload);
    await reloadData(database);
  };

  // 予定を開始して実績へ移す。開始した日の記録として残る。
  const beginPlannedWorkout = async (workoutId: string): Promise<void> => {
    const database = ensureDb();
    await startPlannedWorkout(database, workoutId, formatDate(new Date()));
    await reloadData(database);
    void syncInBackground();
  };

  // クラウドのバックアップでローカルを置き換える（復元）。呼び出し側で確認ダイアログを出す。
  const restoreFromCloud = async () => {
    const database = ensureDb();
    const connection = ensureSyncConnection();
    const payload = await fetchBackupFromCloud(connection.apiUrl, await getIdToken());
    await applyBackupPayload(database, payload);
    await reloadData(database);
    setPendingSyncCount(0);
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
    deletedSets,
    exerciseById,
    bodyPartById,
    activeWorkoutExercises,
    completedWorkouts,
    plannedWorkouts,
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
    pendingSyncCount,
    account,
    isGoogleSignInAvailable: isGoogleSignInConfigured(),
    signInToGoogle,
    signOutOfGoogle,
    updateSyncConnection,
    updateSyncPaused,
    syncNow,
    syncInBackground,
    importPlans,
    importPlansInBackground,
    beginPlannedWorkout,
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
