import { createFakeDatabase } from '../../test-support/fakeDatabase';
import { enqueueUpsert } from '../outbox';
import {
  clearWorkoutExerciseRestOverride,
  completeStaleActiveWorkouts,
  startPlannedWorkout,
  updateWorkoutDate,
} from '../queries';

jest.mock('../outbox', () => ({
  enqueueUpsert: jest.fn().mockResolvedValue(undefined),
  enqueueDelete: jest.fn().mockResolvedValue(undefined),
}));

const enqueueUpsertMock = jest.mocked(enqueueUpsert);

beforeEach(() => {
  jest.clearAllMocks();
});

// 「日付が変わっただけの記録中ワークアウト」を閉じる境目。
// ここを誤ると、今日のセットが前日の日付で積まれ続ける（実際に起きた不具合）。
describe('completeStaleActiveWorkouts', () => {
  const staleRows = [{ id: 'w-yesterday' }];

  it('4時を過ぎていれば前日ぶんを閉じる', async () => {
    const fake = createFakeDatabase({ getAll: () => staleRows });
    const closed = await completeStaleActiveWorkouts(
      fake.database,
      new Date(2026, 7, 27, 9, 0),
    );

    expect(closed).toBe(1);
    expect(fake.runsMatching("status = 'completed'")).toHaveLength(1);
    expect(enqueueUpsertMock).toHaveBeenCalledWith(fake.database, 'workouts', 'w-yesterday');
  });

  it('4時より前は前日ぶんを残す（深夜をまたぐセッションを切らない）', async () => {
    const seen: unknown[][] = [];
    const fake = createFakeDatabase({
      getAll: (_sql, params) => {
        seen.push(params);
        return [];
      },
    });
    await completeStaleActiveWorkouts(fake.database, new Date(2026, 7, 27, 1, 30));

    // 締めの基準日が前日（＝一昨日以前だけが対象）になる。
    expect(seen[0]).toEqual(['2026-08-26']);
  });

  it('4時を過ぎたら基準日は今日になる', async () => {
    const seen: unknown[][] = [];
    const fake = createFakeDatabase({
      getAll: (_sql, params) => {
        seen.push(params);
        return [];
      },
    });
    await completeStaleActiveWorkouts(fake.database, new Date(2026, 7, 27, 4, 0));

    expect(seen[0]).toEqual(['2026-08-27']);
  });

  it('最後の保存時刻では判定しない（翌日の操作で延命されない）', async () => {
    const fake = createFakeDatabase({ getAll: () => staleRows });
    await completeStaleActiveWorkouts(fake.database, new Date(2026, 7, 27, 9, 0));

    const select = fake.runs.length > 0 ? fake.runs[0].sql : '';
    expect(select).not.toContain('last_saved_at');
  });

  it('対象が無ければ何も書かず 0 を返す', async () => {
    const fake = createFakeDatabase({ getAll: () => [] });
    const closed = await completeStaleActiveWorkouts(fake.database, new Date(2026, 7, 27, 9, 0));

    expect(closed).toBe(0);
    expect(fake.runs).toHaveLength(0);
    expect(enqueueUpsertMock).not.toHaveBeenCalled();
  });

  it('複数件あれば全部閉じて件数を返す', async () => {
    const fake = createFakeDatabase({ getAll: () => [{ id: 'w1' }, { id: 'w2' }] });
    const closed = await completeStaleActiveWorkouts(fake.database, new Date(2026, 7, 27, 9, 0));

    expect(closed).toBe(2);
    expect(enqueueUpsertMock).toHaveBeenCalledTimes(2);
  });
});

describe('startPlannedWorkout', () => {
  it('実施日を開始した日で上書きする', async () => {
    const fake = createFakeDatabase();
    await startPlannedWorkout(fake.database, 'plan-1', '2026-08-27');

    const [update] = fake.runsMatching("status = 'active'");
    expect(update.sql).toContain("WHERE id = ? AND status = 'planned'");
    expect(update.params[0]).toBe('2026-08-27');
    expect(update.params.at(-1)).toBe('plan-1');
  });

  it('予定が持ち込んだ休憩の上書きを外す', async () => {
    const fake = createFakeDatabase({
      getAll: () => [{ id: 'we-1' }, { id: 'we-2' }],
    });
    await startPlannedWorkout(fake.database, 'plan-1', '2026-08-27');

    expect(fake.runsMatching('rest_seconds_override = NULL')).toHaveLength(2);
    expect(enqueueUpsertMock).toHaveBeenCalledWith(fake.database, 'workout_exercises', 'we-1');
    expect(enqueueUpsertMock).toHaveBeenCalledWith(fake.database, 'workout_exercises', 'we-2');
  });

  it('上書きを持たない記録では余計な書き込みをしない', async () => {
    const fake = createFakeDatabase({ getAll: () => [] });
    await startPlannedWorkout(fake.database, 'plan-1', '2026-08-27');

    expect(fake.runsMatching('rest_seconds_override')).toHaveLength(0);
  });

  it('予定でなければ何もしない（自分で決めた休憩を消さない）', async () => {
    const fake = createFakeDatabase({
      changes: () => 0,
      getAll: () => [{ id: 'we-1' }],
    });
    await startPlannedWorkout(fake.database, 'already-active', '2026-08-27');

    expect(fake.runsMatching('rest_seconds_override')).toHaveLength(0);
    expect(enqueueUpsertMock).not.toHaveBeenCalled();
  });
});

describe('updateWorkoutDate', () => {
  it('実施日だけを変え、最後の保存時刻には触らない', async () => {
    const fake = createFakeDatabase();
    await updateWorkoutDate(fake.database, 'w1', '2026-08-25');

    const [update] = fake.runsMatching('performed_at = ?');
    expect(update.sql).not.toContain('last_saved_at');
    expect(update.params).toEqual(['2026-08-25', expect.any(String), 'w1']);
    expect(enqueueUpsertMock).toHaveBeenCalledWith(fake.database, 'workouts', 'w1');
  });
});

describe('clearWorkoutExerciseRestOverride', () => {
  it('その種目行の上書きだけを外して送信キューへ積む', async () => {
    const fake = createFakeDatabase();
    await clearWorkoutExerciseRestOverride(fake.database, 'we-1');

    const [update] = fake.runsMatching('rest_seconds_override = NULL');
    expect(update.params.at(-1)).toBe('we-1');
    expect(enqueueUpsertMock).toHaveBeenCalledWith(fake.database, 'workout_exercises', 'we-1');
  });
});
