import {
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
} from '../../test-support/factories';
import { buildDayMarks } from '../calendarMarks';

const exerciseById = new Map([
  ['bench-press', buildExercise({ id: 'bench-press' })],
  ['incline-press', buildExercise({ id: 'incline-press' })],
  ['squat', buildExercise({ id: 'squat', primaryBodyPartId: 'legs' })],
]);

describe('buildDayMarks', () => {
  it('同じ部位の種目はマークをまとめて数える', () => {
    const marks = buildDayMarks(
      [buildWorkout({ id: 'w1', performedAt: '2026-08-27' })],
      [
        buildWorkoutExercise({ id: 'we1', workoutId: 'w1', exerciseId: 'bench-press' }),
        buildWorkoutExercise({
          id: 'we2',
          workoutId: 'w1',
          exerciseId: 'incline-press',
          orderIndex: 2,
        }),
      ],
      exerciseById,
    );
    expect(marks.get('2026-08-27')?.marks).toEqual([
      expect.objectContaining({ bodyPartId: 'chest', count: 2 }),
    ]);
  });

  it('マークは種目の入力順（orderIndex）に並ぶ', () => {
    const marks = buildDayMarks(
      [buildWorkout({ id: 'w1', performedAt: '2026-08-27' })],
      [
        buildWorkoutExercise({ id: 'we-legs', workoutId: 'w1', exerciseId: 'squat', orderIndex: 1 }),
        buildWorkoutExercise({
          id: 'we-chest',
          workoutId: 'w1',
          exerciseId: 'bench-press',
          orderIndex: 2,
        }),
      ],
      exerciseById,
    );
    expect(marks.get('2026-08-27')?.marks.map((mark) => mark.bodyPartId)).toEqual([
      'legs',
      'chest',
    ]);
  });

  it('予定だけの日は isPlannedOnly になる', () => {
    const marks = buildDayMarks(
      [buildWorkout({ id: 'p', performedAt: '2026-08-28', status: 'planned' })],
      [buildWorkoutExercise({ id: 'we', workoutId: 'p' })],
      exerciseById,
    );
    expect(marks.get('2026-08-28')?.isPlannedOnly).toBe(true);
  });

  it('同じ日に実績があれば予定だけ扱いを外す', () => {
    const marks = buildDayMarks(
      [
        buildWorkout({ id: 'p', performedAt: '2026-08-28', status: 'planned' }),
        buildWorkout({ id: 'done', performedAt: '2026-08-28' }),
      ],
      [
        buildWorkoutExercise({ id: 'we-p', workoutId: 'p', orderIndex: 1 }),
        buildWorkoutExercise({ id: 'we-done', workoutId: 'done', orderIndex: 2 }),
      ],
      exerciseById,
    );
    expect(marks.get('2026-08-28')?.isPlannedOnly).toBe(false);
  });

  it('workout が引けない種目行は無視する', () => {
    const marks = buildDayMarks([], [buildWorkoutExercise({ workoutId: 'gone' })], exerciseById);
    expect(marks.size).toBe(0);
  });

  it('種目が引けない行は未分類としてまとめる', () => {
    const marks = buildDayMarks(
      [buildWorkout({ id: 'w1', performedAt: '2026-08-27' })],
      [buildWorkoutExercise({ id: 'we', workoutId: 'w1', exerciseId: 'gone' })],
      new Map(),
    );
    expect(marks.get('2026-08-27')?.marks[0].bodyPartId).toBe('unknown');
  });
});
