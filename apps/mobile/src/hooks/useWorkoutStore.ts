import { setAudioModeAsync } from 'expo-audio';
import * as SQLite from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { GoogleAccount } from '../auth/googleAuth';
import { restoreAccount } from '../auth/googleAuth';
import { loadWorkoutData } from '../db/loadWorkoutData';
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
  UserExerciseSetting,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import { DEFAULT_REST_PRESETS } from '../types/domain';
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

  const reloadData = useCallback(async (database: SQLite.SQLiteDatabase) => {
    const data = await loadWorkoutData(database);
    setBodyParts(data.bodyParts);
    setExercises(data.exercises);
    setUserExerciseSettings(data.userExerciseSettings);
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
    ensureDb,
  };
}
