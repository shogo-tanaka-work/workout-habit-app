import { toExercise, toUserExerciseSetting, toWorkout, toWorkoutSet } from '../mappers';

// 0/1 と NULL の扱いを固定する。ここを取り違えると
// 「非表示にしたはずの種目が出る」「削除済みセットが集計に入る」形で表に出る。
describe('toExercise', () => {
  it('is_archived の 0/1 を boolean にする', () => {
    const row = {
      id: 'bench-press',
      name: 'ベンチプレス',
      primary_body_part_id: 'chest',
      default_rest_seconds: 120,
      default_bar_weight_kg: 20,
      category: 'compound',
      is_archived: 1,
    };
    expect(toExercise(row)).toEqual({
      id: 'bench-press',
      name: 'ベンチプレス',
      primaryBodyPartId: 'chest',
      defaultRestSeconds: 120,
      defaultBarWeightKg: 20,
      category: 'compound',
      isArchived: true,
    });
    expect(toExercise({ ...row, is_archived: 0 }).isArchived).toBe(false);
  });
});

describe('toUserExerciseSetting', () => {
  const row = {
    id: 'setting-1',
    exercise_id: 'bench-press',
    rest_seconds: null,
    bar_weight_kg: null,
    is_archived: null,
  };

  it('NULL は「上書きしない」として null のまま保つ', () => {
    expect(toUserExerciseSetting(row)).toMatchObject({
      restSeconds: null,
      barWeightKg: null,
      isArchived: null,
    });
  });

  it('0/1 が入っていれば boolean にする', () => {
    expect(toUserExerciseSetting({ ...row, is_archived: 0 }).isArchived).toBe(false);
    expect(toUserExerciseSetting({ ...row, is_archived: 1 }).isArchived).toBe(true);
  });
});

describe('toWorkout', () => {
  it('status をそのまま持つ', () => {
    const workout = toWorkout({
      id: 'w1',
      performed_at: '2026-08-27',
      status: 'planned',
      memo: 'メモ',
      last_saved_at: '2026-08-27T10:00:00.000Z',
      created_at: '2026-08-27T09:00:00.000Z',
    });
    expect(workout).toEqual({
      id: 'w1',
      performedAt: '2026-08-27',
      status: 'planned',
      memo: 'メモ',
      lastSavedAt: '2026-08-27T10:00:00.000Z',
      createdAt: '2026-08-27T09:00:00.000Z',
    });
  });
});

describe('toWorkoutSet', () => {
  const row = {
    id: 'set-1',
    workout_exercise_id: 'we-1',
    order_index: 1,
    weight_kg: 60,
    reps: 10,
    rpe: 0,
    is_warmup: 1,
    is_completed: 0,
    memo: '',
    rest_seconds: 120,
    deleted_at: null,
  };

  it('フラグを boolean にし、削除時刻は null のまま保つ', () => {
    expect(toWorkoutSet(row)).toMatchObject({
      isWarmup: true,
      isCompleted: false,
      deletedAt: null,
    });
  });

  it('削除済みは deletedAt を持つ', () => {
    expect(toWorkoutSet({ ...row, deleted_at: '2026-08-27T10:00:00.000Z' }).deletedAt).toBe(
      '2026-08-27T10:00:00.000Z',
    );
  });
});
