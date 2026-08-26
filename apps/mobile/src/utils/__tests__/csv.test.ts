import {
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { buildBodyLogCsv, buildWorkoutCsv } from '../csv';

const exerciseById = new Map([['bench-press', buildExercise()]]);

describe('buildWorkoutCsv', () => {
  it('古い日付から並べ、セット番号を振り直す', () => {
    const csv = buildWorkoutCsv(
      [
        buildWorkout({ id: 'w-new', performedAt: '2026-08-27' }),
        buildWorkout({ id: 'w-old', performedAt: '2026-08-20' }),
      ],
      [
        buildWorkoutExercise({ id: 'we-new', workoutId: 'w-new' }),
        buildWorkoutExercise({ id: 'we-old', workoutId: 'w-old' }),
      ],
      [
        buildWorkoutSet({ id: 's-new', workoutExerciseId: 'we-new', orderIndex: 5 }),
        buildWorkoutSet({ id: 's-old', workoutExerciseId: 'we-old', orderIndex: 3 }),
      ],
      exerciseById,
    );
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'date,exercise,set,weight_kg,reps,rpe,is_warmup,memo,exercise_memo',
    );
    // 欠番のある orderIndex ではなく、並べ直した連番になる。
    expect(lines[1]).toBe('2026-08-20,ベンチプレス,1,60,10,0,0,,');
    expect(lines[2]).toBe('2026-08-27,ベンチプレス,1,60,10,0,0,,');
  });

  it('ウォームアップを 1 で出す', () => {
    const csv = buildWorkoutCsv(
      [buildWorkout({ id: 'w1' })],
      [buildWorkoutExercise({ id: 'we1', workoutId: 'w1' })],
      [buildWorkoutSet({ workoutExerciseId: 'we1', isWarmup: true })],
      exerciseById,
    );
    expect(csv.split('\n')[1]).toContain(',1,');
  });

  it('カンマ・引用符・改行を含む値をエスケープする', () => {
    const csv = buildWorkoutCsv(
      [buildWorkout({ id: 'w1' })],
      [buildWorkoutExercise({ id: 'we1', workoutId: 'w1', memo: '肩,痛み' })],
      [buildWorkoutSet({ workoutExerciseId: 'we1', memo: 'フォーム"要確認"' })],
      exerciseById,
    );
    const row = csv.split('\n')[1];
    expect(row).toContain('"フォーム""要確認"""');
    expect(row).toContain('"肩,痛み"');
  });

  it('マスタに無い種目は ID をそのまま出す（記録を落とさない）', () => {
    const csv = buildWorkoutCsv(
      [buildWorkout({ id: 'w1' })],
      [buildWorkoutExercise({ id: 'we1', workoutId: 'w1', exerciseId: 'gone' })],
      [buildWorkoutSet({ workoutExerciseId: 'we1' })],
      new Map(),
    );
    expect(csv.split('\n')[1]).toContain(',gone,');
  });

  it('記録が無ければ見出しだけ返す', () => {
    expect(buildWorkoutCsv([], [], [], exerciseById).split('\n')).toHaveLength(1);
  });
});

describe('buildBodyLogCsv', () => {
  it('古い順に並べ、未入力の体脂肪率は空欄にする', () => {
    const csv = buildBodyLogCsv([
      {
        id: 'b2',
        measuredAt: '2026-08-27',
        bodyWeightKg: 70.5,
        bodyFatPercentage: null,
        memo: '',
      },
      {
        id: 'b1',
        measuredAt: '2026-08-20',
        bodyWeightKg: 71,
        bodyFatPercentage: 18.2,
        memo: '朝',
      },
    ]);
    expect(csv.split('\n')).toEqual([
      'date,body_weight_kg,body_fat_percentage,memo',
      '2026-08-20,71,18.2,朝',
      '2026-08-27,70.5,,',
    ]);
  });
});
