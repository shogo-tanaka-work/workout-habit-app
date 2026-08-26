import {
  buildExercise,
  buildBodyPart,
  buildWorkout,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import {
  buildExerciseSessions,
  buildVolumeSeries,
  formatSetsInline,
  summarizeByBodyPart,
  summarizeByExercise,
  summarizePeriod,
  summarizeSets,
} from '../aggregate';
import { startOfWeekIsoDate } from '../datetime';

describe('summarizeSets', () => {
  it('ワーキングセットだけを集計し、ウォームアップは数だけ数える', () => {
    const summary = summarizeSets([
      buildWorkoutSet({ id: 'a', weightKg: 40, reps: 10, isWarmup: true }),
      buildWorkoutSet({ id: 'b', weightKg: 70, reps: 8 }),
      buildWorkoutSet({ id: 'c', weightKg: 70, reps: 6 }),
    ]);
    expect(summary.setCount).toBe(2);
    expect(summary.warmupCount).toBe(1);
    expect(summary.totalReps).toBe(14);
    expect(summary.maxReps).toBe(8);
    // ウォームアップの 40×10 は入らない。
    expect(summary.totalVolume).toBe(70 * 8 + 70 * 6);
  });

  it('セットが無ければすべて 0', () => {
    expect(summarizeSets([])).toEqual({
      setCount: 0,
      warmupCount: 0,
      totalReps: 0,
      maxReps: 0,
      totalVolume: 0,
      bestOneRepMax: 0,
    });
  });

  it('除数を渡すと推定1RMの式が変わる', () => {
    const sets = [buildWorkoutSet({ weightKg: 100, reps: 5 })];
    // Epley（÷30）: 100 * (1 + 5/30) = 116.7 / ベンチ（÷40）: 100 * (1 + 5/40) = 112.5
    expect(summarizeSets(sets).bestOneRepMax).toBe(116.7);
    expect(summarizeSets(sets, 40).bestOneRepMax).toBe(112.5);
  });
});

describe('formatSetsInline', () => {
  it('ウォームアップに印を付けて並べる', () => {
    const text = formatSetsInline([
      buildWorkoutSet({ id: 'a', weightKg: 40, reps: 10, isWarmup: true }),
      buildWorkoutSet({ id: 'b', weightKg: 70, reps: 8 }),
    ]);
    expect(text).toBe('WU 40kg×10 / 70kg×8');
  });

  it('セットが無ければ空文字', () => {
    expect(formatSetsInline([])).toBe('');
  });
});

describe('buildExerciseSessions', () => {
  const workouts = [
    buildWorkout({ id: 'w2', performedAt: '2026-08-27' }),
    buildWorkout({ id: 'w1', performedAt: '2026-08-20' }),
  ];
  const workoutExercises = [
    buildWorkoutExercise({ id: 'we2', workoutId: 'w2', exerciseId: 'bench-press' }),
    buildWorkoutExercise({ id: 'we1', workoutId: 'w1', exerciseId: 'bench-press' }),
    buildWorkoutExercise({ id: 'we-other', workoutId: 'w1', exerciseId: 'squat' }),
  ];
  const sets = [
    buildWorkoutSet({ id: 's2', workoutExerciseId: 'we2', orderIndex: 1 }),
    buildWorkoutSet({ id: 's1b', workoutExerciseId: 'we1', orderIndex: 2, reps: 6 }),
    buildWorkoutSet({ id: 's1a', workoutExerciseId: 'we1', orderIndex: 1, reps: 8 }),
    buildWorkoutSet({ id: 's-other', workoutExerciseId: 'we-other' }),
  ];

  it('渡された workouts の順序を保ったまま、その種目のぶんだけ返す', () => {
    const sessions = buildExerciseSessions('bench-press', workouts, workoutExercises, sets);
    expect(sessions.map((session) => session.workout.id)).toEqual(['w2', 'w1']);
  });

  it('セットを orderIndex 順に並べる', () => {
    const sessions = buildExerciseSessions('bench-press', workouts, workoutExercises, sets);
    expect(sessions[1].sets.map((set) => set.id)).toEqual(['s1a', 's1b']);
  });

  it('セットが1つも無い実施はセッションにしない', () => {
    const sessions = buildExerciseSessions(
      'bench-press',
      workouts,
      workoutExercises,
      sets.filter((set) => set.workoutExerciseId !== 'we2'),
    );
    expect(sessions.map((session) => session.workout.id)).toEqual(['w1']);
  });

  it('種目ごとの除数で推定1RMを出す（ベンチプレスは ÷40）', () => {
    const sessions = buildExerciseSessions(
      'bench-press',
      [buildWorkout({ id: 'w2' })],
      [buildWorkoutExercise({ id: 'we2', workoutId: 'w2', exerciseId: 'bench-press' })],
      [buildWorkoutSet({ workoutExerciseId: 'we2', weightKg: 100, reps: 5 })],
    );
    expect(sessions[0].summary.bestOneRepMax).toBe(112.5);
  });
});

describe('summarizePeriod', () => {
  it('期間に含まれる workout のセットだけを集計する', () => {
    const inPeriod = buildWorkout({ id: 'in' });
    const summary = summarizePeriod(
      [inPeriod],
      [
        buildWorkoutExercise({ id: 'we-in', workoutId: 'in' }),
        buildWorkoutExercise({ id: 'we-out', workoutId: 'out' }),
      ],
      [
        buildWorkoutSet({ id: 's-in', workoutExerciseId: 'we-in', weightKg: 60, reps: 10 }),
        buildWorkoutSet({ id: 's-out', workoutExerciseId: 'we-out', weightKg: 99, reps: 10 }),
      ],
    );
    expect(summary.workoutCount).toBe(1);
    expect(summary.totalVolume).toBe(600);
  });
});

describe('summarizeByExercise', () => {
  it('ボリューム降順に並べ、セットの無い種目は落とす', () => {
    const totals = summarizeByExercise(
      [buildWorkout({ id: 'w1' })],
      [
        buildWorkoutExercise({ id: 'we-bench', workoutId: 'w1', exerciseId: 'bench-press' }),
        buildWorkoutExercise({ id: 'we-squat', workoutId: 'w1', exerciseId: 'squat' }),
        buildWorkoutExercise({ id: 'we-empty', workoutId: 'w1', exerciseId: 'deadlift' }),
      ],
      [
        buildWorkoutSet({ id: 's1', workoutExerciseId: 'we-bench', weightKg: 60, reps: 10 }),
        buildWorkoutSet({ id: 's2', workoutExerciseId: 'we-squat', weightKg: 100, reps: 10 }),
      ],
      new Map([
        ['bench-press', buildExercise({ id: 'bench-press', name: 'ベンチプレス' })],
        ['squat', buildExercise({ id: 'squat', name: 'スクワット', primaryBodyPartId: 'legs' })],
      ]),
    );
    expect(totals.map((total) => total.exerciseId)).toEqual(['squat', 'bench-press']);
    expect(totals[0].sessionCount).toBe(1);
  });

  it('マスタに無い種目でも既定名で残す', () => {
    const totals = summarizeByExercise(
      [buildWorkout({ id: 'w1' })],
      [buildWorkoutExercise({ id: 'we', workoutId: 'w1', exerciseId: 'gone' })],
      [buildWorkoutSet({ workoutExerciseId: 'we' })],
      new Map(),
    );
    expect(totals[0].name).toBe('種目');
    expect(totals[0].bodyPartId).toBeUndefined();
  });
});

describe('buildVolumeSeries', () => {
  it('日付キーごとに合算し、古い順で返す', () => {
    const series = buildVolumeSeries(
      [
        buildWorkout({ id: 'w-new', performedAt: '2026-08-27' }),
        buildWorkout({ id: 'w-old', performedAt: '2026-08-20' }),
      ],
      [
        buildWorkoutExercise({ id: 'we-new', workoutId: 'w-new' }),
        buildWorkoutExercise({ id: 'we-old', workoutId: 'w-old' }),
      ],
      [
        buildWorkoutSet({ id: 's1', workoutExerciseId: 'we-new', weightKg: 60, reps: 10 }),
        buildWorkoutSet({ id: 's2', workoutExerciseId: 'we-new', weightKg: 60, reps: 5 }),
        buildWorkoutSet({ id: 's3', workoutExerciseId: 'we-old', weightKg: 50, reps: 10 }),
      ],
      (isoDate) => isoDate,
    );
    expect(series).toEqual([
      { date: '2026-08-20', value: 500 },
      { date: '2026-08-27', value: 900 },
    ]);
  });

  it('ウォームアップは積み上げない', () => {
    const series = buildVolumeSeries(
      [buildWorkout({ id: 'w1', performedAt: '2026-08-27' })],
      [buildWorkoutExercise({ id: 'we', workoutId: 'w1' })],
      [buildWorkoutSet({ workoutExerciseId: 'we', weightKg: 40, reps: 10, isWarmup: true })],
      (isoDate) => isoDate,
    );
    expect(series).toEqual([]);
  });

  it('週バケットへまとめられる', () => {
    const series = buildVolumeSeries(
      [
        buildWorkout({ id: 'w1', performedAt: '2026-08-25' }),
        buildWorkout({ id: 'w2', performedAt: '2026-08-27' }),
      ],
      [
        buildWorkoutExercise({ id: 'we1', workoutId: 'w1' }),
        buildWorkoutExercise({ id: 'we2', workoutId: 'w2' }),
      ],
      [
        buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1', weightKg: 10, reps: 10 }),
        buildWorkoutSet({ id: 's2', workoutExerciseId: 'we2', weightKg: 10, reps: 10 }),
      ],
      startOfWeekIsoDate,
    );
    expect(series).toEqual([{ date: '2026-08-24', value: 200 }]);
  });
});

describe('summarizeByBodyPart', () => {
  it('部位ごとにボリューム降順でまとめる', () => {
    const summaries = summarizeByBodyPart(
      [
        buildWorkoutExercise({ id: 'we-chest', exerciseId: 'bench-press' }),
        buildWorkoutExercise({ id: 'we-legs', exerciseId: 'squat' }),
      ],
      [
        buildWorkoutSet({ id: 's1', workoutExerciseId: 'we-chest', weightKg: 60, reps: 10 }),
        buildWorkoutSet({ id: 's2', workoutExerciseId: 'we-legs', weightKg: 100, reps: 10 }),
        buildWorkoutSet({
          id: 's3',
          workoutExerciseId: 'we-legs',
          weightKg: 40,
          reps: 10,
          isWarmup: true,
        }),
      ],
      new Map([
        ['bench-press', buildExercise({ id: 'bench-press' })],
        ['squat', buildExercise({ id: 'squat', primaryBodyPartId: 'legs' })],
      ]),
      new Map([
        ['chest', buildBodyPart()],
        ['legs', buildBodyPart({ id: 'legs', name: '脚' })],
      ]),
    );
    expect(summaries.map((summary) => summary.bodyPartId)).toEqual(['legs', 'chest']);
    // ウォームアップはセット数にもボリュームにも入らない。
    expect(summaries[0]).toMatchObject({ name: '脚', setCount: 1, totalVolume: 1000 });
  });

  it('種目が引けないセットは未分類にする', () => {
    const summaries = summarizeByBodyPart(
      [buildWorkoutExercise({ id: 'we', exerciseId: 'gone' })],
      [buildWorkoutSet({ workoutExerciseId: 'we', weightKg: 10, reps: 10 })],
      new Map(),
      new Map(),
    );
    expect(summaries[0]).toMatchObject({ bodyPartId: 'unknown', name: '未分類' });
  });
});
