import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';

import { CloudSyncSection } from './src/components/CloudSyncSection';
import { ExerciseEditModal } from './src/components/ExerciseEditModal';
import { PlateCalculator } from './src/components/PlateCalculator';
import { RestPickerModal } from './src/components/RestPickerModal';
import { TimerBanner } from './src/components/TimerBanner';
import { useRestTimer } from './src/hooks/useRestTimer';
import { useWorkoutData } from './src/hooks/useWorkoutData';
import type { CsvExportRequest } from './src/screens/CsvExportScreen';
import { CsvExportScreen } from './src/screens/CsvExportScreen';
import { ExerciseDetailScreen } from './src/screens/ExerciseDetailScreen';
import { ExerciseListScreen } from './src/screens/ExerciseListScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import type { SettingsRoute } from './src/screens/SettingsScreen';
import { SETTINGS_TITLES, SettingsScreen } from './src/screens/SettingsScreen';
import { TimerSettingsScreen } from './src/screens/TimerSettingsScreen';
import { WorkoutEditScreen } from './src/screens/WorkoutEditScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { styles } from './src/styles/appStyles';
import type { Tab, WorkoutExercise, WorkoutSet } from './src/types/domain';
import type { ExerciseSession } from './src/utils/aggregate';
import { buildExerciseSessions } from './src/utils/aggregate';
import { buildBodyLogCsv, buildWorkoutCsv } from './src/utils/csv';
import { formatJapaneseDate } from './src/utils/datetime';
import { exercisesInWorkout } from './src/utils/workoutTree';

// 記録画面で見せる過去の実施記録の回数。多すぎると前回との比較がぼやける。
const RECENT_SESSION_COUNT = 5;

export default function App() {
  const data = useWorkoutData();
  const { timer, setTimer } = useRestTimer(data.timerSettings, data.database);

  // UI（ナビゲーション・入力・編集状態）はシェルである App が保持する。
  const [tab, setTab] = useState<Tab>('home');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  // 編集中の種目 ID。モーダルの表示はこれで決める。
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [restPicker, setRestPicker] = useState<{ exerciseId: string; seconds: number } | null>(
    null,
  );
  // 設定タブで開いているサブ画面。null なら入口のメニュー。
  const [settingsRoute, setSettingsRoute] = useState<SettingsRoute | null>(null);

  // 送信の補助的な契機。バックグラウンドへ移るとき（記録を終えて画面を閉じたとき）と、
  // 戻ってきたとき（通信が復帰している可能性がある）に、溜まった操作を送る。
  const { syncInBackground, importPlansInBackground } = data;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'active') {
        void syncInBackground();
      }
      // 予定の取り込みは復帰時だけ。Claude Code が書いた計画を持ち帰る向きなので、
      // アプリを閉じる方向では要らない。
      if (state === 'active') {
        void importPlansInBackground();
      }
    });
    return () => subscription.remove();
  }, [syncInBackground, importPlansInBackground]);

  // 起動直後にも一度取り込む（AppState の change は起動時には発火しない）。
  useEffect(() => {
    void importPlansInBackground();
  }, [importPlansInBackground]);

  // 記録中の各種目について、直近の完了済み実施記録を新しい順に引く。
  // 記録画面で「過去 n 回分の記録」として並べる（1回だけだと調子の良し悪しが分からない）。
  const recentSessionsByExerciseId = useMemo(() => {
    const map = new Map<string, ExerciseSession[]>();
    if (!data.activeWorkout) {
      return map;
    }
    for (const workoutExercise of data.activeWorkoutExercises) {
      map.set(
        workoutExercise.exerciseId,
        buildExerciseSessions(
          workoutExercise.exerciseId,
          data.completedWorkouts,
          data.workoutExercises,
          data.visibleSets,
        ).slice(0, RECENT_SESSION_COUNT),
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

  // 種目ごとの直近の実施日。種目選択で「何日前にやったか」を出すために使う。
  const lastPerformedByExerciseId = useMemo(() => {
    const performedAtByWorkoutId = new Map(
      data.completedWorkouts.map((workout) => [workout.id, workout.performedAt]),
    );
    const map = new Map<string, string>();
    for (const item of data.workoutExercises) {
      const performedAt = performedAtByWorkoutId.get(item.workoutId);
      if (!performedAt) {
        continue;
      }
      const current = map.get(item.exerciseId);
      if (!current || current < performedAt) {
        map.set(item.exerciseId, performedAt);
      }
    }
    return map;
  }, [data.completedWorkouts, data.workoutExercises]);

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

  // 完了したらホームへ戻す。直後に見たいのは「今日の記録が入ったカレンダー」で、
  // 期間の集計（履歴）ではない。
  const handleComplete = async () => {
    await data.completeWorkout();
    setTab('home');
  };

  const handlePause = async () => {
    await data.pauseWorkout();
    setTab('home');
  };

  // 過去の記録の編集は、タブとは別レイヤの画面として全面に出す。
  const editingWorkout = editingWorkoutId
    ? (data.completedWorkouts.find((workout) => workout.id === editingWorkoutId) ?? null)
    : null;
  const editingWorkoutExercises = useMemo(
    () =>
      editingWorkoutId
        ? exercisesInWorkout(editingWorkoutId, data.workoutExercises)
        : [],
    [editingWorkoutId, data.workoutExercises],
  );

  // タブの上へ全面でかぶせる画面（戻る導線つき）。3つは同時に開かない。
  const overlay = selectedExercise
    ? { title: selectedExercise.name, close: () => setSelectedExerciseId(null) }
    : editingWorkout
      ? {
          title: `${formatJapaneseDate(editingWorkout.performedAt)} の記録`,
          close: () => setEditingWorkoutId(null),
        }
      : settingsRoute
        ? { title: SETTINGS_TITLES[settingsRoute], close: () => setSettingsRoute(null) }
        : null;

  const isHomeTab = tab === 'home' && overlay === null;

  // タブを移ったら設定の階層は入口へ戻す。別タブから帰ってきたとき、
  // 前に見ていた下の階層が出ていると、どこにいるのか分からなくなる。
  const handleSelectTab = (next: Tab) => {
    setTab(next);
    setSettingsRoute(null);
  };

  const editingExercise = editingExerciseId
    ? (data.exerciseById.get(editingExerciseId) ?? null)
    : null;

  // Promise を返す操作を、戻り値 void の props へ渡すときの受け口。
  //
  // `void data.addSet(...)` のように捨てると、保存の失敗が誰にも伝わらないまま消える
  // （記録できていないのに気づけないのが一番困る）。必ずここを通して報告する。
  // 文脈つきのメッセージは db/queries.ts の writeWithOutbox が付けている。
  const reportFailure = (error: unknown): void => {
    console.error('[App] 操作に失敗', error);
    Alert.alert('操作に失敗しました', error instanceof Error ? error.message : String(error));
  };

  const runAction = (action: () => Promise<unknown>): void => {
    action().catch(reportFailure);
  };

  // 成否で画面を進めるか決めたいときに使う。失敗の報告は runAction と同じ。
  const runActionForResult = async (action: () => Promise<unknown>): Promise<boolean> => {
    try {
      await action();
      return true;
    } catch (error: unknown) {
      reportFailure(error);
      return false;
    }
  };

  const handleStartRestTimer = async (set: WorkoutSet, workoutExercise: WorkoutExercise) => {
    const nextTimer = await data.beginRestTimer(set, workoutExercise);
    setTimer(nextTimer);
  };

  const handleAddCustomExercise = async (bodyPartId: string) => {
    const added = await data.addCustomExercise(newExerciseName, bodyPartId);
    if (added) {
      setNewExerciseName('');
    }
  };

  // ホームで選んだ日の記録を直す。タブの上へ編集画面をかぶせる。
  const handleEditWorkoutFromHome = (workoutId: string) => {
    setEditingWorkoutId(workoutId);
  };

  // ホーム右下の主操作。記録中なら続きへ、なければ新しく始める。
  const handleFabPress = () => {
    if (data.activeWorkout) {
      setTab('workout');
      return;
    }
    runAction(handleStart);
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    setEditingWorkoutId(null);
    await data.deleteWorkout(workoutId);
  };

  const openRestPicker = (exerciseId: string, seconds: number) => {
    setRestPicker({ exerciseId, seconds });
  };

  // 選んだ対象・期間の記録をCSVにして共有シートへ渡す（ファイル保存・AirDrop・メール等）。
  const handleExportCsv = async (request: CsvExportRequest) => {
    try {
      const since = request.since;
      const parts: string[] = [];
      if (request.targets.includes('workouts')) {
        const workouts = since
          ? data.completedWorkouts.filter((workout) => workout.performedAt >= since)
          : data.completedWorkouts;
        parts.push(
          buildWorkoutCsv(workouts, data.workoutExercises, data.visibleSets, data.exerciseById),
        );
      }
      if (request.targets.includes('bodyLogs')) {
        const logs = since ? data.bodyLogs.filter((log) => log.measuredAt >= since) : data.bodyLogs;
        parts.push(buildBodyLogCsv(logs));
      }
      // 2種類を選んだときは1つのテキストにまとめる。列が違うので空行で区切る。
      await Share.share({ message: parts.join('\n\n') });
    } catch (error: unknown) {
      Alert.alert(
        'エクスポートに失敗しました',
        error instanceof Error ? error.message : String(error),
      );
    }
  };

  // 決めた秒数はこの種目へ、共通タイマーのプリセットは全体設定へ保存する。
  const confirmRestPicker = async (seconds: number, presets: number[]) => {
    if (restPicker) {
      const exercise = data.exerciseById.get(restPicker.exerciseId);
      if (exercise) {
        await data.updateExerciseRest(exercise, Math.max(0, seconds));
      }
    }
    await data.updateTimerSettings({ ...data.timerSettings, restPresets: presets });
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
        {/* アプリ名の固定表示は置かない（狭い画面を1行ぶん取られるため）。
            ヘッダーは、戻る導線が要る画面のときだけ出す。 */}
        {overlay ? (
          <View style={styles.header}>
            <Pressable style={styles.headerBackButton} onPress={overlay.close}>
              <Text style={styles.headerBackText}>‹</Text>
              <Text style={styles.appName}>{overlay.title}</Text>
            </Pressable>
          </View>
        ) : null}

        {timer ? <TimerBanner timer={timer} setTimer={setTimer} /> : null}

        {overlay ? null : (
          <View style={styles.tabs}>
            {(
              [
                ['home', 'ホーム'],
                ['workout', '記録'],
                ['history', '履歴'],
                ['settings', '設定'],
              ] as const
            ).map(([key, label]) => (
              <Pressable
                key={key}
                onPress={() => handleSelectTab(key)}
                style={[styles.tab, tab === key && styles.activeTab]}
              >
                <Text style={[styles.tabText, tab === key && styles.activeTabText]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {isHomeTab ? (
          // ホームだけは画面全体をスクロールさせない。カレンダーを固定して、
          // 下半分（選んだ日の内容）だけがスクロールする構成にしている。
          <View style={styles.homeContent}>
            <HomeScreen
              activeWorkout={data.activeWorkout}
              completedWorkouts={data.completedWorkouts}
              plannedWorkouts={data.plannedWorkouts}
              workoutExercises={data.workoutExercises}
              visibleSets={data.visibleSets}
              exerciseById={data.exerciseById}
              bodyLogs={data.bodyLogs}
              onResume={() => setTab('workout')}
              onBeginPlanned={(workoutId) => {
                runAction(() => data.beginPlannedWorkout(workoutId).then(() => setTab('workout')));
              }}
              onEditWorkout={handleEditWorkoutFromHome}
              onSelectExercise={setSelectedExerciseId}
              onSaveBodyLog={(measuredAt, weightKg, fatPercentage) =>
                runAction(() => data.saveBodyLog(measuredAt, weightKg, fatPercentage))
              }
            />
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {selectedExercise ? (
              <ExerciseDetailScreen
                exercise={selectedExercise}
                sessions={selectedExerciseSessions}
              />
            ) : editingWorkout ? (
              <WorkoutEditScreen
                workout={editingWorkout}
                workoutExercises={editingWorkoutExercises}
                visibleSets={data.visibleSets}
                exerciseById={data.exerciseById}
                onAddSet={(item) => runAction(() => data.addSet(item))}
                onPatchSet={(setId, patch) => runAction(() => data.patchSet(setId, patch))}
                onDeleteWorkout={(workoutId) => runAction(() => handleDeleteWorkout(workoutId))}
              />
            ) : settingsRoute === 'exercises' ? (
              <ExerciseListScreen
                exercises={data.exercises}
                bodyParts={data.bodyParts}
                bodyPartById={data.bodyPartById}
                newExerciseName={newExerciseName}
                onChangeNewExerciseName={setNewExerciseName}
                onAddCustomExercise={(bodyPartId) =>
                  runAction(() => handleAddCustomExercise(bodyPartId))
                }
                onEditExercise={setEditingExerciseId}
                onSelectExercise={setSelectedExerciseId}
              />
            ) : settingsRoute === 'timer' ? (
              <TimerSettingsScreen
                timerSettings={data.timerSettings}
                onUpdate={(settings) => runAction(() => data.updateTimerSettings(settings))}
              />
            ) : settingsRoute === 'plates' ? (
              <PlateCalculator />
            ) : settingsRoute === 'csv' ? (
              <CsvExportScreen onExport={(request) => runAction(() => handleExportCsv(request))} />
            ) : settingsRoute === 'sync' ? (
              <CloudSyncSection
                syncSettings={data.syncSettings}
                pendingCount={data.pendingSyncCount}
                account={data.account}
                isGoogleSignInAvailable={data.isGoogleSignInAvailable}
                onSaveConnection={data.updateSyncConnection}
                onSignIn={data.signInToGoogle}
                onSignOut={data.signOutOfGoogle}
                onSyncNow={data.syncNow}
                onImportPlans={data.importPlans}
                onTogglePaused={data.updateSyncPaused}
                onRestore={data.restoreFromCloud}
              />
            ) : (
              <>
                {tab === 'workout' ? (
                  <WorkoutScreen
                    activeWorkout={data.activeWorkout}
                    workoutExercises={data.activeWorkoutExercises}
                    visibleSets={data.visibleSets}
                    exercises={data.exercisesByUsage}
                    exerciseById={data.exerciseById}
                    bodyParts={data.bodyParts}
                    recentSessionsByExerciseId={recentSessionsByExerciseId}
                    lastPerformedByExerciseId={lastPerformedByExerciseId}
                    templates={data.templates}
                    templateExercises={data.templateExercises}
                    onStart={() => runAction(handleStart)}
                    onStartFromTemplate={(template) =>
                      runAction(() => data.startWorkoutFromTemplate(template))
                    }
                    onSaveTemplate={(name) => runAction(() => data.saveActiveWorkoutAsTemplate(name))}
                    onDeleteTemplate={(templateId) => runAction(() => data.deleteTemplate(templateId))}
                    onComplete={() => runAction(handleComplete)}
                    onPause={() => runAction(handlePause)}
                    onAddExercise={(exercise) =>
                      runActionForResult(() => data.addExerciseToWorkout(exercise))
                    }
                    onAddCustomExercise={(name, bodyPartId) =>
                      runAction(() => data.addCustomExercise(name, bodyPartId))
                    }
                    onAddSet={(item) => runAction(() => data.addSet(item))}
                    onPatchSet={(setId, patch) => runAction(() => data.patchSet(setId, patch))}
                    onStartRestTimer={(set, item) => runAction(() => handleStartRestTimer(set, item))}
                    onOpenRestPicker={openRestPicker}
                  />
                ) : null}

                {tab === 'history' ? (
                  <HistoryScreen
                    workouts={data.completedWorkouts}
                    workoutExercises={data.workoutExercises}
                    visibleSets={data.visibleSets}
                    exerciseById={data.exerciseById}
                    bodyPartById={data.bodyPartById}
                    bodyLogs={data.bodyLogs}
                    onSelectExercise={setSelectedExerciseId}
                  />
                ) : null}

                {tab === 'settings' ? <SettingsScreen onOpen={setSettingsRoute} /> : null}
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {isHomeTab ? (
        <Pressable
          style={styles.fab}
          onPress={handleFabPress}
          accessibilityRole="button"
          accessibilityLabel={data.activeWorkout ? '記録の続きへ' : '今日のトレーニングを記録する'}
        >
          <Text style={styles.fabText}>＋</Text>
        </Pressable>
      ) : null}

      {editingExercise ? (
        <ExerciseEditModal
          exercise={editingExercise}
          bodyParts={data.bodyParts}
          onSave={(next) => {
            setEditingExerciseId(null);
            runAction(() => data.saveExercise(next));
          }}
          onCancel={() => setEditingExerciseId(null)}
        />
      ) : null}

      {restPicker ? (
        <RestPickerModal
          value={restPicker.seconds}
          presets={data.timerSettings.restPresets}
          onConfirm={(seconds, presets) =>
            runAction(() => confirmRestPicker(seconds, presets))
          }
          onCancel={() => setRestPicker(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
