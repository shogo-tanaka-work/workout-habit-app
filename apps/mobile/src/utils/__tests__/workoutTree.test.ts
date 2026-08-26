import {
  buildExercise,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { exerciseNameOf, exercisesInWorkout, setsOfWorkoutExercises } from '../workoutTree';

describe('exercisesInWorkout', () => {
  it('そのワークアウトの種目を orderIndex 順で返す', () => {
    const items = exercisesInWorkout('w1', [
      buildWorkoutExercise({ id: 'b', workoutId: 'w1', orderIndex: 3 }),
      buildWorkoutExercise({ id: 'a', workoutId: 'w1', orderIndex: 1 }),
      buildWorkoutExercise({ id: 'other', workoutId: 'w2', orderIndex: 2 }),
    ]);
    expect(items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('該当が無ければ空配列', () => {
    expect(exercisesInWorkout('none', [buildWorkoutExercise()])).toEqual([]);
  });
});

describe('setsOfWorkoutExercises', () => {
  it('渡した種目行に属するセットだけを返す', () => {
    const sets = setsOfWorkoutExercises(
      [buildWorkoutExercise({ id: 'we1' })],
      [
        buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1' }),
        buildWorkoutSet({ id: 's2', workoutExerciseId: 'we2' }),
      ],
    );
    expect(sets.map((set) => set.id)).toEqual(['s1']);
  });
});

describe('exerciseNameOf', () => {
  it('マスタから名前を引く', () => {
    const map = new Map([['bench-press', buildExercise()]]);
    expect(exerciseNameOf('bench-press', map)).toBe('ベンチプレス');
  });

  it('未知の ID でも画面を壊さない既定値へ落とす', () => {
    expect(exerciseNameOf('gone', new Map())).toBe('種目');
  });
});
