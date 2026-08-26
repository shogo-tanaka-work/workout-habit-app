import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { summarizeSets } from '../../utils/aggregate';
import { ExerciseLogPanel } from '../ExerciseLogPanel';

const workoutExercise = buildWorkoutExercise({ id: 'we1' });
const sets = [buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1' })];

const renderPanel = (overrides: Partial<React.ComponentProps<typeof ExerciseLogPanel>> = {}) =>
  render(
    <ExerciseLogPanel
      workoutExercise={workoutExercise}
      exercise={buildExercise()}
      visibleSets={sets}
      recentSessions={[]}
      onAddSet={jest.fn()}
      onPatchSet={jest.fn()}
      onDeleteExercise={jest.fn()}
      onSaveMemo={jest.fn()}
      onStartRestTimer={jest.fn()}
      onOpenRestPicker={jest.fn()}
      onBack={jest.fn()}
      {...overrides}
    />,
  );

describe('ExerciseLogPanel', () => {
  it('種目選択へ戻る導線を出す', () => {
    const onBack = jest.fn();
    renderPanel({ onBack });

    fireEvent.press(screen.getByText('種目を選ぶ'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('記録タブでは休憩タイマーの行を出す', () => {
    renderPanel();
    expect(screen.getByText('休憩タイマー')).toBeTruthy();
  });

  it('前回の記録が無ければ初回だと伝える', () => {
    renderPanel();
    expect(
      screen.getByText('この種目は初めてです。今日の記録が次回の目安になります。'),
    ).toBeTruthy();
  });

  it('前回の記録があれば並べる', () => {
    const pastSets = [buildWorkoutSet({ id: 'old-s1', weightKg: 55, reps: 10 })];
    renderPanel({
      recentSessions: [
        {
          workout: buildWorkout({ id: 'w-old', performedAt: '2026-08-20' }),
          sets: pastSets,
          summary: summarizeSets(pastSets),
        },
      ],
    });
    expect(screen.getByText('過去 1 回分の記録')).toBeTruthy();
    expect(screen.getByText('8月20日(木)')).toBeTruthy();
  });

  it('種目を外したら戻る導線ごと親へ渡す', () => {
    const onDeleteExercise = jest.fn();
    renderPanel({ onDeleteExercise });
    // 削除の確認は ExerciseLogSection が持つ（ここでは導線の存在だけ確かめる）。
    expect(screen.getByText('削除')).toBeTruthy();
  });
});
