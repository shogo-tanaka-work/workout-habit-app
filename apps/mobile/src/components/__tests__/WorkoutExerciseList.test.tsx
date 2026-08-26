import { render, screen } from '@testing-library/react-native';

import {
  buildExercise,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { WorkoutExerciseList } from '../WorkoutExerciseList';

const exerciseById = new Map([['bench-press', buildExercise()]]);

const renderList = (
  overrides: Partial<React.ComponentProps<typeof WorkoutExerciseList>> = {},
) =>
  render(
    <WorkoutExerciseList
      workoutExercises={[buildWorkoutExercise({ id: 'we1' })]}
      visibleSets={[buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1' })]}
      exerciseById={exerciseById}
      isRecording={false}
      onAddSet={jest.fn()}
      onPatchSet={jest.fn()}
      onDeleteExercise={jest.fn()}
      onSaveMemo={jest.fn()}
      onStartRestTimer={jest.fn()}
      onOpenRestPicker={jest.fn()}
      {...overrides}
    />,
  );

describe('WorkoutExerciseList', () => {
  it('種目ごとに記録カードを並べる', () => {
    renderList({
      workoutExercises: [
        buildWorkoutExercise({ id: 'we1', exerciseId: 'bench-press' }),
        buildWorkoutExercise({ id: 'we2', exerciseId: 'bench-press', orderIndex: 2 }),
      ],
    });
    expect(screen.getAllByText('ベンチプレス')).toHaveLength(2);
  });

  it('過去日の記録では休憩タイマーを出さない', () => {
    renderList();
    expect(screen.queryByText('休憩タイマー')).toBeNull();
  });

  it('記録中なら休憩タイマーを出す', () => {
    renderList({ isRecording: true });
    expect(screen.getByText('休憩タイマー')).toBeTruthy();
  });

  it('種目が無ければ何も描かない', () => {
    const { toJSON } = renderList({ workoutExercises: [] });
    expect(toJSON()).toBeNull();
  });
});
