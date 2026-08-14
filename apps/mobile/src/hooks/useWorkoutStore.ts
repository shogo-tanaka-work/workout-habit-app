import { setAudioModeAsync } from 'expo-audio';
import * as SQLite from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { GoogleAccount } from '../auth/googleAuth';
import { restoreAccount } from '../auth/googleAuth';
import type { WorkoutTable } from '../db/loadWorkoutData';
import { ALL_WORKOUT_TABLES, loadWorkoutTables } from '../db/loadWorkoutData';
import { runMigrations } from '../db/migrations';
import { countPendingOperations } from '../db/outbox';
import { seedMasters } from '../db/seed';
import type {
  BodyLog,
  BodyPart,
  Exercise,
  SyncSettings,
  Template,
  TemplateExercise,
  TimerSettings,
  TrainingPhase,
  UserExerciseSetting,
  UserProfile,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import { DEFAULT_REST_PRESETS } from '../types/domain';
import { findCurrentPhase } from '../utils/trainingProfile';
import { exercisesInWorkout } from '../utils/workoutTree';

// 端末 DB の初期化と、読み込んだデータの保持。**書き込みは持たない。**
//
// 「今どうなっているか」だけを受け持ち、変更の操作は useWorkoutCommands、
// サーバとのやり取りは useSync が持つ。分けているのは変更理由が別だから
// （画面に出す派生値を足す変更と、同期の契機を変える変更は無関係）。
//
// 派生値（activeWorkout・visibleSets・byId の Map など）はここで一度だけ作って配る。
// 画面ごとに組み立てると、同じ絞り込みが各所に散る。

export type WorkoutStore = ReturnType<typeof useWorkoutStore>;

export function useWorkoutStore() {
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
    restPresets: DEFAULT_REST_PRESETS,
  });
  const [userExerciseSettings, setUserExerciseSettings] = useState<UserExerciseSetting[]>([]);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  // 基本情報は0行または1行。未設定を null で表す。
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [trainingPhases, setTrainingPhases] = useState<TrainingPhase[]>([]);
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

  // 選択肢に出す種目。アーカイブ済みは除く（exerciseById には残すので、
  // 過去の記録からは引き続き名前を引ける）。
  const activeExercises = useMemo(
    () => exercises.filter((exercise) => !exercise.isArchived),
    [exercises],
  );

  // 現在のフェーズ（進行中のうち開始日が最大のもの）。画面ごとに判定させない。
  const currentTrainingPhase = useMemo(() => findCurrentPhase(trainingPhases), [trainingPhases]);

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
    return exercisesInWorkout(activeWorkout.id, workoutExercises);
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

  // 記録画面の種目追加用に、使用回数の多い順（同数は名前順）へ並べ替えた種目一覧。
  const exercisesByUsage = useMemo(() => {
    const usageCount = new Map<string, number>();
    for (const item of workoutExercises) {
      usageCount.set(item.exerciseId, (usageCount.get(item.exerciseId) ?? 0) + 1);
    }
    return [...activeExercises].sort((a, b) => {
      const countDiff = (usageCount.get(b.id) ?? 0) - (usageCount.get(a.id) ?? 0);
      return countDiff !== 0 ? countDiff : a.name.localeCompare(b.name, 'ja');
    });
  }, [activeExercises, workoutExercises]);

  // 書き込んだテーブルだけを読み直す。全テーブルを読み直すと全 state の参照が変わり、
  // 無関係な画面の再レンダリングと useMemo の再計算まで走るため。
  const reloadTables = useCallback(
    async (database: SQLite.SQLiteDatabase, tables: readonly WorkoutTable[]) => {
      const startedAtMs = Date.now();
      const data = await loadWorkoutTables(database, tables);
      if (data.bodyParts) setBodyParts(data.bodyParts);
      if (data.exercises) setExercises(data.exercises);
      if (data.userExerciseSettings) setUserExerciseSettings(data.userExerciseSettings);
      if (data.workouts) setWorkouts(data.workouts);
      if (data.workoutExercises) setWorkoutExercises(data.workoutExercises);
      if (data.workoutSets) setWorkoutSets(data.workoutSets);
      if (data.templates) setTemplates(data.templates);
      if (data.templateExercises) setTemplateExercises(data.templateExercises);
      if (data.timerSettings) setTimerSettings(data.timerSettings);
      if (data.bodyLogs) setBodyLogs(data.bodyLogs);
      if (data.syncSettings) setSyncSettings(data.syncSettings);
      // 基本情報は「未設定 = null」が正しい値。真偽で見ると、消えたことを反映できない。
      if (data.userProfile !== undefined) setUserProfile(data.userProfile);
      if (data.trainingPhases) setTrainingPhases(data.trainingPhases);
      setPendingSyncCount(await countPendingOperations(database));
      if (__DEV__) {
        // 実機計測用。書き込み後の再読込にかかった時間を粒度つきで出す。
        console.log(`[perf] reload ${tables.join('+')} ${String(Date.now() - startedAtMs)}ms`);
      }
    },
    [],
  );

  // 全テーブルの再読込。起動時の初期化と、クラウド復元（全テーブルが変わる）だけが使う。
  const reloadData = useCallback(
    (database: SQLite.SQLiteDatabase) => reloadTables(database, ALL_WORKOUT_TABLES),
    [reloadTables],
  );

  useEffect(() => {
    let mounted = true;
    const setup = async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const database = await SQLite.openDatabaseAsync('workout-habit.db');
        // 参照整合性を効かせるため、接続ごとに有効化する（既定は OFF）。
        await database.execAsync('PRAGMA foreign_keys = ON');
        // WAL 化。DB ファイルに永続する冪等な設定だが、migration のトランザクション内では
        // 実行できない（SQLite がエラーにする）ため、必ずここ（トランザクション外）で行う。
        await database.execAsync('PRAGMA journal_mode = WAL');
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
    // ログイン状態の復元（silent sign-in）。記録・閲覧・タイマーはログイン不要のため、
    // DB 準備の直列に入れず並行して走らせ、結果だけを後から反映する。
    // restoreAccount は失敗を内部でログして null を返すので、ここで throw は起きない。
    const restoreSignIn = async () => {
      const restored = await restoreAccount();
      if (mounted && restored) {
        setAccount(restored);
      }
    };
    void setup();
    void restoreSignIn();
    return () => {
      mounted = false;
    };
  }, [reloadData]);

  const ensureDb = useCallback((): SQLite.SQLiteDatabase => {
    if (!db) {
      throw new Error('データベースの準備がまだ終わっていません');
    }
    return db;
  }, [db]);
  return {
    database: db,
    isReady,
    errorMessage,
    bodyParts,
    exercises,
    activeExercises,
    exercisesByUsage,
    workouts,
    workoutExercises,
    workoutSets,
    visibleSets,
    templates,
    templateExercises,
    timerSettings,
    userExerciseSettings,
    bodyLogs,
    syncSettings,
    userProfile,
    trainingPhases,
    currentTrainingPhase,
    account,
    pendingSyncCount,
    activeWorkout,
    activeWorkoutExercises,
    completedWorkouts,
    plannedWorkouts,
    exerciseById,
    bodyPartById,
    workoutExerciseById,
    setTimerSettings,
    setSyncSettings,
    setAccount,
    setPendingSyncCount,
    reloadData,
    reloadTables,
    ensureDb,
  };
}
