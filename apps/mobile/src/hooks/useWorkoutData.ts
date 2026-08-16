import * as SQLite from 'expo-sqlite';
import { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';

import {
  deleteTemplateDeep,
  deleteWorkoutDeep,
  deleteWorkoutExerciseDeep,
  insertCompletedWorkout,
  insertExercise,
  insertTemplateDeep,
  insertTimerEvent,
  insertWorkout,
  insertWorkoutDeep,
  insertWorkoutExercise,
  insertWorkoutSet,
  setExerciseRest,
  setWorkoutStatus,
  startPlannedWorkout,
  startTrainingPhase,
  touchWorkout,
  updateExercise,
  updateWorkoutExerciseMemo,
  updateWorkoutSet,
  upsertBodyLog,
  upsertUserExerciseSetting,
  upsertUserProfile,
} from '../db/queries';
import { findActiveWorkoutRow } from '../db/loadWorkoutData';
import { upsertTimerSettings } from '../db/appSettings';
import { isCustomExerciseId, newCustomExerciseId } from '../db/syncTables';
import type {
  Exercise,
  SetPatch,
  Template,
  TimerSettings,
  TimerState,
  TrainingGoal,
  TrainingPhaseKind,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import { formatDate, nowMs } from '../utils/datetime';
import { newId } from '../utils/id';
import { restSecondsFor } from '../utils/restPresets';
import { exerciseNameOf, exercisesInWorkout } from '../utils/workoutTree';
import { useSync } from './useSync';
import { useWorkoutStore } from './useWorkoutStore';

// 記録の書き込み（CRUD）と、画面が使う値をまとめて配るファサード。
//
// 状態の保持は useWorkoutStore、サーバとのやり取りは useSync が持つ。
// ここに残っているのは「記録をどう変えるか」だけ。
// UI（タブ・編集中ID・入力欄など）の状態は持たず、App 側が管理する。
//
// 書き込み関数はすべて useCallback で参照を安定させている。App がこれらを
// ハンドラへ束ねて memo したコンポーネントに配るため、毎レンダー作り直すと
// memo が一切効かなくなる。
export function useWorkoutData() {
  const store = useWorkoutStore();
  const {
    bodyParts,
    exercises,
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
    userProfile,
    trainingPhases,
    currentTrainingPhase,
    pendingSyncCount,
    activeWorkout,
    activeWorkoutExercises,
    completedWorkouts,
    plannedWorkouts,
    exerciseById,
    bodyPartById,
    workoutExerciseById,
    setTimerSettings,
    reloadTables,
    ensureDb,
  } = store;

  // サーバとのやり取りは useSync が持つ。書き込みの後に送信を促すためここで受け取る。
  const sync = useSync(store);
  const { syncInBackground } = sync;

  /**
   * 今日のワークアウトを開始し、その ID を返す。既に記録中ならその ID を返す。
   *
   * **ID を返すのは、開始直後に続けて書き込む呼び出しがあるため。**
   * `activeWorkout` は state なので、この関数を await した直後にはまだ古い値のままで、
   * それを見て書き込むと「開始はしたが中身が入らない」状態になる。
   */
  const startWorkout = useCallback(async (): Promise<string> => {
    const database = ensureDb();
    const existingActive = await findActiveWorkoutRow(database);
    if (existingActive) {
      // state が知らない記録中の行が DB にあったときの取り込み。書き込みは無い。
      await reloadTables(database, ['workouts']);
      return existingActive.id;
    }
    const workoutId = newId('workout');
    await insertWorkout(database, { id: workoutId, performedAt: formatDate(new Date()) });
    await reloadTables(database, ['workouts']);
    return workoutId;
  }, [ensureDb, reloadTables]);

  /**
   * 過去の日付の記録を作り、その ID を返す（後から入れ直すとき用）。
   *
   * 記録中として開始する `startWorkout` とは別の操作にしている。過去の記録は実施済みで、
   * 端末が持てる `active` は1つという前提を壊さないため、完了済みとして作る。
   */
  const addPastWorkout = useCallback(
    async (performedAt: string): Promise<string> => {
      const database = ensureDb();
      const workoutId = newId('workout');
      await insertCompletedWorkout(database, { id: workoutId, performedAt });
      await reloadTables(database, ['workouts']);
      void syncInBackground();
      return workoutId;
    },
    [ensureDb, reloadTables, syncInBackground],
  );

  const completeWorkout = useCallback(async () => {
    if (!activeWorkout) {
      return;
    }
    const database = ensureDb();
    await setWorkoutStatus(database, activeWorkout.id, 'completed');
    await reloadTables(database, ['workouts']);
    void syncInBackground();
  }, [activeWorkout, ensureDb, reloadTables, syncInBackground]);

  const pauseWorkout = useCallback(async () => {
    if (activeWorkout) {
      await touchWorkout(ensureDb(), activeWorkout.id);
    }
  }, [activeWorkout, ensureDb]);

  const deleteWorkout = useCallback(
    async (workoutId: string) => {
      const database = ensureDb();
      await deleteWorkoutDeep(database, workoutId);
      await reloadTables(database, ['workouts', 'workout_exercises', 'workout_sets']);
    },
    [ensureDb, reloadTables],
  );

  // 記録中でなければ、まず開始してからその記録へ種目を足す。
  // かつては開始だけして戻っていたため、呼び出し側が「追加された」前提で画面を進め、
  // 空のワークアウトに存在しない種目のパネルが開いていた。
  const addExerciseToWorkout = useCallback(
    async (exercise: Exercise) => {
      const database = ensureDb();
      const workoutId = activeWorkout?.id ?? (await startWorkout());
      // 開始直後は activeWorkoutExercises がまだ空なので、既存の記録のときだけ重複を見る。
      if (activeWorkout) {
        const alreadyAdded = activeWorkoutExercises.some((item) => item.exerciseId === exercise.id);
        if (alreadyAdded) {
          Alert.alert('追加済み', `${exercise.name} は今日の記録に入っています。`);
          return;
        }
      }
      await insertWorkoutExercise(database, {
        id: newId('workout-exercise'),
        workoutId,
        exerciseId: exercise.id,
        orderIndex: activeWorkoutExercises.length + 1,
      });
      await touchWorkout(database, workoutId);
      await reloadTables(database, ['workouts', 'workout_exercises']);
    },
    [activeWorkout, activeWorkoutExercises, ensureDb, reloadTables, startWorkout],
  );

  /**
   * ホームの日詳細から開いた記録（編集画面）へ種目を足す。
   *
   * 記録中への追加は `addExerciseToWorkout` が持つ。あちらは記録中が無ければ開始まで行うが、
   * ここは既にある記録が対象なので、開始も日付の決定も起きない。
   */
  const addExerciseToEditedWorkout = useCallback(
    async (workoutId: string, exercise: Exercise) => {
      const database = ensureDb();
      const items = exercisesInWorkout(workoutId, workoutExercises);
      if (items.some((item) => item.exerciseId === exercise.id)) {
        Alert.alert('追加済み', `${exercise.name} はこの記録に入っています。`);
        return;
      }
      await insertWorkoutExercise(database, {
        id: newId('workout-exercise'),
        workoutId,
        exerciseId: exercise.id,
        orderIndex: items.length + 1,
      });
      await touchWorkout(database, workoutId);
      await reloadTables(database, ['workouts', 'workout_exercises']);
      void syncInBackground();
    },
    [ensureDb, reloadTables, syncInBackground, workoutExercises],
  );

  /** 記録から種目を外す。セットごと消えるので、確認は呼び出し側（UI）が済ませている前提。 */
  const deleteWorkoutExercise = useCallback(
    async (workoutExercise: WorkoutExercise) => {
      const database = ensureDb();
      await deleteWorkoutExerciseDeep(database, workoutExercise.id);
      await touchWorkout(database, workoutExercise.workoutId);
      await reloadTables(database, ['workouts', 'workout_exercises', 'workout_sets']);
      void syncInBackground();
    },
    [ensureDb, reloadTables, syncInBackground],
  );

  /** 種目ごとのメモを保存する。入力の確定ごとに呼ばれる（打鍵ごとではない）。 */
  const saveExerciseMemo = useCallback(
    async (workoutExercise: WorkoutExercise, memo: string) => {
      const database = ensureDb();
      await updateWorkoutExerciseMemo(database, workoutExercise.id, memo);
      await touchWorkout(database, workoutExercise.workoutId);
      await reloadTables(database, ['workouts', 'workout_exercises']);
    },
    [ensureDb, reloadTables],
  );

  const addSet = useCallback(
    async (workoutExercise: WorkoutExercise) => {
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
        restSeconds: restSecondsFor(workoutExercise, exercise),
      });
      if (workoutExercise.workoutId) {
        await touchWorkout(database, workoutExercise.workoutId);
      }
      await reloadTables(database, ['workouts', 'workout_sets']);
    },
    [ensureDb, exerciseById, reloadTables, workoutSets],
  );

  const patchSet = useCallback(
    async (setId: string, patch: SetPatch) => {
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
      await reloadTables(database, ['workouts', 'workout_sets']);

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
    },
    [ensureDb, reloadTables, syncInBackground, workoutExerciseById, workoutSets],
  );

  // 休憩タイマーの開始。セットを完了扱いにし timer_events を記録、TimerState を返す。
  // 返した状態は呼び出し側（App）が useRestTimer の setTimer に渡す。
  const beginRestTimer = useCallback(
    async (set: WorkoutSet, workoutExercise: WorkoutExercise): Promise<TimerState> => {
      const database = ensureDb();
      const exercise = exerciseById.get(workoutExercise.exerciseId);
      const duration = Math.max(
        1,
        // このセットに保存済みの秒数があればそれを優先する（過去のセットを再開する場合）。
        set.restSeconds ?? restSecondsFor(workoutExercise, exercise),
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
        exerciseName: exerciseNameOf(workoutExercise.exerciseId, exerciseById),
        duration,
        remaining: duration,
        running: true,
        finished: false,
        endsAt: nowMs() + duration * 1000,
      };
    },
    [ensureDb, exerciseById, patchSet],
  );

  // カスタム種目の追加。空文字なら何もせず false を返す（呼び出し側の入力クリア判断に使う）。
  const addCustomExercise = useCallback(
    async (rawName: string, bodyPartId: string): Promise<boolean> => {
      const name = rawName.trim();
      if (!name) {
        return false;
      }
      const database = ensureDb();
      await insertExercise(database, {
        id: newCustomExerciseId(),
        name,
        // 部位は呼び出し側で選ばせる。既定を押し付けると全部が最初の部位になる。
        primaryBodyPartId: bodyPartId || (bodyParts[0]?.id ?? 'chest'),
      });
      await reloadTables(database, ['exercises']);
      return true;
    },
    [bodyParts, ensureDb, reloadTables],
  );

  // 種目の設定変更は種類で経路が分かれる。
  //
  // カスタム種目は自分の行なので `exercises` を直接更新する。
  // プリセットは全ユーザー共有でサーバが書き換えを拒むため、上書きテーブルへ書く。
  // ここを間違えると、端末だけ変わってサーバと静かに食い違う。
  const settingByExerciseId = useMemo(
    () => new Map(userExerciseSettings.map((setting) => [setting.exerciseId, setting])),
    [userExerciseSettings],
  );

  const writeExerciseOverride = useCallback(
    async (
      database: SQLite.SQLiteDatabase,
      exerciseId: string,
      patch: Partial<{
        restSeconds: number | null;
        barWeightKg: number | null;
        isArchived: boolean | null;
      }>,
    ): Promise<void> => {
      const current = settingByExerciseId.get(exerciseId);
      await upsertUserExerciseSetting(database, {
        exerciseId,
        restSeconds:
          patch.restSeconds !== undefined ? patch.restSeconds : (current?.restSeconds ?? null),
        barWeightKg:
          patch.barWeightKg !== undefined ? patch.barWeightKg : (current?.barWeightKg ?? null),
        isArchived:
          patch.isArchived !== undefined ? patch.isArchived : (current?.isArchived ?? null),
      });
    },
    [settingByExerciseId],
  );

  // 種目の設定を保存する。**プリセットは対象外**（サーバが書き換えを拒むため、
  // 端末だけ変えるとサーバと静かに食い違う）。
  const saveExercise = useCallback(
    async (next: Exercise): Promise<void> => {
      const database = ensureDb();
      if (isCustomExerciseId(next.id)) {
        await updateExercise(database, next);
        await setExerciseRest(database, next.id, next.defaultRestSeconds);
      } else {
        // プリセットは名前と部位を変えられない（共有の意味が失われるため）。
        // 上書きできるのは休憩・バー重量・非表示だけ。
        await writeExerciseOverride(database, next.id, {
          restSeconds: next.defaultRestSeconds,
          barWeightKg: next.defaultBarWeightKg,
          isArchived: next.isArchived,
        });
      }
      await reloadTables(database, ['exercises', 'user_exercise_settings']);
      void syncInBackground();
    },
    [ensureDb, reloadTables, syncInBackground, writeExerciseOverride],
  );

  const updateExerciseRest = useCallback(
    async (exercise: Exercise, restSeconds: number) => {
      const database = ensureDb();
      if (isCustomExerciseId(exercise.id)) {
        await setExerciseRest(database, exercise.id, restSeconds);
      } else {
        await writeExerciseOverride(database, exercise.id, { restSeconds });
      }
      await reloadTables(database, ['exercises', 'user_exercise_settings']);
      void syncInBackground();
    },
    [ensureDb, reloadTables, syncInBackground, writeExerciseOverride],
  );

  // 記録中のワークアウトの種目並びをテンプレートとして保存する。
  // 名前が空・種目ゼロなら何もせず false を返す。
  const saveActiveWorkoutAsTemplate = useCallback(
    async (rawName: string): Promise<boolean> => {
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
      await reloadTables(database, ['templates', 'template_exercises']);
      return true;
    },
    [activeWorkoutExercises, ensureDb, reloadTables],
  );

  // テンプレートからワークアウトを開始する（種目をまとめて追加）。
  const startWorkoutFromTemplate = useCallback(
    async (template: Template) => {
      const database = ensureDb();
      const existingActive = await findActiveWorkoutRow(database);
      if (existingActive) {
        Alert.alert('記録中のワークアウトがあります', '先に完了するか、再開してください。');
        // state が知らない記録中の行が DB にあったときの取り込み。書き込みは無い。
        await reloadTables(database, ['workouts']);
        return;
      }
      const entries = templateExercises
        .filter((item) => item.templateId === template.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      await insertWorkoutDeep(database, {
        id: newId('workout'),
        performedAt: formatDate(new Date()),
        exerciseEntries: entries.map((entry) => ({
          id: newId('workout-exercise'),
          exerciseId: entry.exerciseId,
        })),
      });
      await reloadTables(database, ['workouts', 'workout_exercises']);
    },
    [ensureDb, reloadTables, templateExercises],
  );

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      const database = ensureDb();
      await deleteTemplateDeep(database, templateId);
      await reloadTables(database, ['templates', 'template_exercises']);
    },
    [ensureDb, reloadTables],
  );

  // タイマー設定（音・振動）を保存し、即座に state へ反映する。
  const updateTimerSettings = useCallback(
    async (settings: TimerSettings) => {
      await upsertTimerSettings(ensureDb(), settings);
      setTimerSettings(settings);
    },
    [ensureDb, setTimerSettings],
  );

  const beginPlannedWorkout = useCallback(
    async (workoutId: string): Promise<void> => {
      const database = ensureDb();
      await startPlannedWorkout(database, workoutId, formatDate(new Date()));
      await reloadTables(database, ['workouts']);
      void syncInBackground();
    },
    [ensureDb, reloadTables, syncInBackground],
  );

  // 今日のボディログを保存する（同日があれば上書き）。体重 0 以下は無効として false。
  // measuredAt はホームのカレンダーで選んだ日。1日1件で、既存の日は上書きされる。
  const saveBodyLog = useCallback(
    async (
      measuredAt: string,
      bodyWeightKg: number,
      bodyFatPercentage: number | null,
    ): Promise<boolean> => {
      if (bodyWeightKg <= 0) {
        return false;
      }
      const database = ensureDb();
      await upsertBodyLog(database, {
        id: newId('body-log'),
        measuredAt,
        bodyWeightKg,
        bodyFatPercentage: bodyFatPercentage && bodyFatPercentage > 0 ? bodyFatPercentage : null,
      });
      await reloadTables(database, ['body_logs']);
      return true;
    },
    [ensureDb, reloadTables],
  );

  // 基本情報（目的・身長・メモ）の保存。身長は任意入力で、未入力は null のまま保つ。
  const saveUserProfile = useCallback(
    async (profile: {
      trainingGoal: TrainingGoal;
      heightCm: number | null;
      note: string;
    }): Promise<void> => {
      const database = ensureDb();
      await upsertUserProfile(database, profile);
      await reloadTables(database, ['user_profile']);
      void syncInBackground();
    },
    [ensureDb, reloadTables, syncInBackground],
  );

  // フェーズの切り替え。進行中のフェーズを閉じる処理は queries 側の1トランザクションに入っている。
  const switchTrainingPhase = useCallback(
    async (params: {
      phase: TrainingPhaseKind;
      startedOn: string;
      note: string;
    }): Promise<void> => {
      const database = ensureDb();
      await startTrainingPhase(database, params);
      await reloadTables(database, ['training_phases']);
      void syncInBackground();
    },
    [ensureDb, reloadTables, syncInBackground],
  );

  return {
    // 休憩タイマーの永続化に使う（useRestTimer が直接読み書きする）。
    database: store.database,
    isReady: store.isReady,
    errorMessage: store.errorMessage,
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
    plannedWorkouts,
    exercisesByUsage,
    templates,
    templateExercises,
    timerSettings,
    bodyLogs,
    userProfile,
    trainingPhases,
    currentTrainingPhase,
    saveUserProfile,
    switchTrainingPhase,
    saveActiveWorkoutAsTemplate,
    startWorkoutFromTemplate,
    deleteTemplate,
    updateTimerSettings,
    saveBodyLog,
    pendingSyncCount,
    ...sync,
    beginPlannedWorkout,
    startWorkout,
    addPastWorkout,
    completeWorkout,
    pauseWorkout,
    deleteWorkout,
    addExerciseToWorkout,
    addExerciseToEditedWorkout,
    deleteWorkoutExercise,
    saveExerciseMemo,
    addSet,
    patchSet,
    beginRestTimer,
    addCustomExercise,
    saveExercise,
    updateExerciseRest,
  };
}
