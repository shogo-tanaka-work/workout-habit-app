import { renderHook, waitFor } from '@testing-library/react-native';

import { findActiveWorkoutRow } from '../../db/loadWorkoutData';
import {
  clearWorkoutExerciseRestOverride,
  completeStaleActiveWorkouts,
  insertWorkout,
  insertWorkoutExercise,
  insertWorkoutSet,
  setExerciseRest,
  startPlannedWorkout,
  updateWorkoutSet,
  upsertUserExerciseSetting,
} from '../../db/queries';
import { newCustomExerciseId } from '../../db/syncTables';
import {
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { createFakeDatabase } from '../../test-support/fakeDatabase';
import type { WorkoutStore } from '../useWorkoutStore';
import { useWorkoutData } from '../useWorkoutData';

jest.mock('../../db/queries');
jest.mock('../../db/loadWorkoutData', () => ({ findActiveWorkoutRow: jest.fn() }));
jest.mock('../../db/appSettings', () => ({ upsertTimerSettings: jest.fn() }));

// jest.mock のファクトリは外の変数を見られない。mock 接頭辞の変数だけが例外。
const mockSyncInBackground = jest.fn();
jest.mock('../useSync', () => ({
  useSync: () => ({ syncInBackground: mockSyncInBackground }),
}));

let mockStore: WorkoutStore;
jest.mock('../useWorkoutStore', () => ({
  useWorkoutStore: () => mockStore,
}));

const reloadTables = jest.fn().mockResolvedValue(undefined);
const fake = createFakeDatabase();

const buildStore = (overrides: Partial<WorkoutStore> = {}): WorkoutStore =>
  ({
    database: fake.database,
    isReady: true,
    errorMessage: null,
    bodyParts: [],
    exercises: [],
    exercisesByUsage: [],
    workouts: [],
    workoutExercises: [],
    workoutSets: [],
    visibleSets: [],
    templates: [],
    templateExercises: [],
    userExerciseSettings: [],
    bodyLogs: [],
    userProfile: null,
    trainingPhases: [],
    currentTrainingPhase: null,
    pendingSyncCount: 0,
    activeWorkout: null,
    activeWorkoutExercises: [],
    completedWorkouts: [],
    plannedWorkouts: [],
    exerciseById: new Map(),
    bodyPartById: new Map(),
    workoutExerciseById: new Map(),
    setTimerSettings: jest.fn(),
    reloadTables,
    ensureDb: () => fake.database,
    ...overrides,
  }) as unknown as WorkoutStore;

const renderData = (overrides: Partial<WorkoutStore> = {}) => {
  mockStore = buildStore(overrides);
  return renderHook(() => useWorkoutData());
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(findActiveWorkoutRow).mockResolvedValue(null);
  jest.mocked(completeStaleActiveWorkouts).mockResolvedValue(0);
});

describe('startWorkout', () => {
  it('日をまたいだ記録を先に閉じてから始める', async () => {
    const { result } = renderData();

    await result.current.startWorkout();

    expect(completeStaleActiveWorkouts).toHaveBeenCalled();
    expect(insertWorkout).toHaveBeenCalled();
  });

  it('記録中の行が DB にあればそれを使う（二重に作らない）', async () => {
    jest.mocked(findActiveWorkoutRow).mockResolvedValue({ id: 'w-existing' } as never);
    const { result } = renderData();

    const workoutId = await result.current.startWorkout();

    expect(workoutId).toBe('w-existing');
    expect(insertWorkout).not.toHaveBeenCalled();
  });

  it('今日の日付で作る', async () => {
    const { result } = renderData();

    await result.current.startWorkout();

    const [, params] = jest.mocked(insertWorkout).mock.calls[0];
    expect(params.performedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('closeStaleActiveWorkout', () => {
  it('閉じた記録が無ければ読み直さない', async () => {
    const { result } = renderData();

    await result.current.closeStaleActiveWorkout();

    expect(reloadTables).not.toHaveBeenCalled();
  });

  it('閉じたら読み直して送信を促す', async () => {
    jest.mocked(completeStaleActiveWorkouts).mockResolvedValue(1);
    const { result } = renderData();

    await result.current.closeStaleActiveWorkout();

    expect(reloadTables).toHaveBeenCalledWith(fake.database, ['workouts']);
    expect(mockSyncInBackground).toHaveBeenCalled();
  });

  it('失敗しても画面を止めない（次の契機でやり直す）', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.mocked(completeStaleActiveWorkouts).mockRejectedValue(new Error('DB エラー'));
    const { result } = renderData();

    await expect(result.current.closeStaleActiveWorkout()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('addExerciseToWorkout', () => {
  // 記録タブの「種目を選ぶ」は必ずここを通る。日付の締めを飛ばすと、
  // 日をまたいだ記録に今日のセットが積まれ続ける。
  it('追加先の決定を startWorkout に任せる（日付の締めを通す）', async () => {
    const { result } = renderData();

    await result.current.addExerciseToWorkout(buildExercise());

    expect(completeStaleActiveWorkouts).toHaveBeenCalled();
    expect(insertWorkoutExercise).toHaveBeenCalled();
  });

  it('すでに入っている種目は足さない（それでも締めは通る）', async () => {
    jest.mocked(findActiveWorkoutRow).mockResolvedValue({ id: 'w1' } as never);
    const { result } = renderData({
      workoutExercises: [
        buildWorkoutExercise({ id: 'we1', workoutId: 'w1', exerciseId: 'bench-press' }),
      ],
    });

    await result.current.addExerciseToWorkout(buildExercise({ id: 'bench-press' }));

    expect(completeStaleActiveWorkouts).toHaveBeenCalled();
    expect(insertWorkoutExercise).not.toHaveBeenCalled();
  });
});

describe('beginPlannedWorkout', () => {
  it('今日の日付で開始し、種目も読み直す（休憩の上書きが外れるため）', async () => {
    const { result } = renderData();

    await result.current.beginPlannedWorkout('plan-1');

    const [, workoutId, performedAt] = jest.mocked(startPlannedWorkout).mock.calls[0];
    expect(workoutId).toBe('plan-1');
    expect(performedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reloadTables).toHaveBeenCalledWith(fake.database, ['workouts', 'workout_exercises']);
  });
});

describe('updateExerciseRest', () => {
  const customExerciseId = newCustomExerciseId();

  it('記録の種目を指定すると、予定が持ち込んだ上書きも外す', async () => {
    const { result } = renderData();

    await result.current.updateExerciseRest(buildExercise({ id: customExerciseId }), 90, 'we1');

    expect(setExerciseRest).toHaveBeenCalledWith(fake.database, customExerciseId, 90);
    expect(clearWorkoutExerciseRestOverride).toHaveBeenCalledWith(fake.database, 'we1');
  });

  it('種目だけを変えるときは記録に触れない', async () => {
    const { result } = renderData();

    await result.current.updateExerciseRest(buildExercise({ id: customExerciseId }), 90);

    expect(clearWorkoutExerciseRestOverride).not.toHaveBeenCalled();
  });

  it('プリセット種目は共有の行を書き換えず、上書きテーブルへ書く', async () => {
    const { result } = renderData();

    await result.current.updateExerciseRest(buildExercise({ id: 'bench-press' }), 90);

    expect(setExerciseRest).not.toHaveBeenCalled();
    expect(upsertUserExerciseSetting).toHaveBeenCalledWith(
      fake.database,
      expect.objectContaining({ exerciseId: 'bench-press', restSeconds: 90 }),
    );
  });
});

describe('beginRestTimer', () => {
  it('画面に出ている秒数（記録の上書き優先）でタイマーを作る', async () => {
    const workoutExercise = buildWorkoutExercise({ id: 'we1', restSecondsOverride: 90 });
    const set = buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1', restSeconds: 300 });
    const { result } = renderData({
      workoutSets: [set],
      visibleSets: [set],
      exerciseById: new Map([['bench-press', buildExercise({ defaultRestSeconds: 120 })]]),
      workoutExerciseById: new Map([['we1', workoutExercise]]),
    });

    const timer = await result.current.beginRestTimer(set, workoutExercise);

    // 保存済みの set.restSeconds（300）ではなく、画面に出ている 90 で走らせる。
    expect(timer.duration).toBe(90);
    expect(timer.remaining).toBe(90);
    expect(timer.running).toBe(true);
    expect(updateWorkoutSet).toHaveBeenCalledWith(
      fake.database,
      expect.objectContaining({ isCompleted: true, restSeconds: 90 }),
    );
  });
});

describe('patchSet', () => {
  it('その種目の全セットが完了したら送信する', async () => {
    const set = buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1', isCompleted: false });
    const { result } = renderData({
      workoutSets: [set],
      workoutExerciseById: new Map([['we1', buildWorkoutExercise({ id: 'we1' })]]),
    });

    await result.current.patchSet('s1', { isCompleted: true });

    await waitFor(() => expect(mockSyncInBackground).toHaveBeenCalled());
  });

  it('途中のセットでは送信しない（通信を増やさない）', async () => {
    const sets = [
      buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1' }),
      buildWorkoutSet({ id: 's2', workoutExerciseId: 'we1', orderIndex: 2 }),
    ];
    const { result } = renderData({
      workoutSets: sets,
      workoutExerciseById: new Map([['we1', buildWorkoutExercise({ id: 'we1' })]]),
    });

    await result.current.patchSet('s1', { isCompleted: true });

    expect(mockSyncInBackground).not.toHaveBeenCalled();
  });

  it('知らないセットは書き込まない', async () => {
    const { result } = renderData();

    await result.current.patchSet('missing', { reps: 8 });

    expect(updateWorkoutSet).not.toHaveBeenCalled();
  });
});

describe('addSet', () => {
  it('前のセットの重量とレップを引き継ぐ', async () => {
    const previous = buildWorkoutSet({
      id: 's1',
      workoutExerciseId: 'we1',
      weightKg: 62.5,
      reps: 8,
    });
    const { result } = renderData({
      workoutSets: [previous],
      exerciseById: new Map([['bench-press', buildExercise()]]),
    });

    await result.current.addSet(buildWorkoutExercise({ id: 'we1' }));

    const [, params] = jest.mocked(insertWorkoutSet).mock.calls[0];
    expect(params).toMatchObject({ weightKg: 62.5, reps: 8, orderIndex: 2 });
  });

  it('最初のセットは種目の既定バー重量から始める', async () => {
    const { result } = renderData({
      exerciseById: new Map([['bench-press', buildExercise({ defaultBarWeightKg: 20 })]]),
    });

    await result.current.addSet(buildWorkoutExercise({ id: 'we1' }));

    const [, params] = jest.mocked(insertWorkoutSet).mock.calls[0];
    expect(params).toMatchObject({ weightKg: 20, reps: 8, orderIndex: 1 });
  });

  it('削除済みのセットの番号も飛ばして採番する', async () => {
    const deleted = buildWorkoutSet({
      id: 's1',
      workoutExerciseId: 'we1',
      orderIndex: 3,
      deletedAt: '2026-08-27T10:00:00.000Z',
    });
    const { result } = renderData({
      workoutSets: [deleted],
      exerciseById: new Map([['bench-press', buildExercise()]]),
    });

    await result.current.addSet(buildWorkoutExercise({ id: 'we1' }));

    const [, params] = jest.mocked(insertWorkoutSet).mock.calls[0];
    expect(params.orderIndex).toBe(4);
  });
});

describe('addPastWorkout', () => {
  it('過去日は完了済みとして作る（記録中は同時に1つ）', async () => {
    const { result } = renderData({ activeWorkout: buildWorkout({ status: 'active' }) });

    await result.current.addPastWorkout('2026-08-20');

    expect(completeStaleActiveWorkouts).not.toHaveBeenCalled();
    expect(insertWorkout).not.toHaveBeenCalled();
  });
});
