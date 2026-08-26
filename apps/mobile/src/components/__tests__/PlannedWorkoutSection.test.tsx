import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import {
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { PlannedWorkoutSection } from '../PlannedWorkoutSection';

const planned = buildWorkout({ id: 'plan-1', performedAt: '2026-08-28', status: 'planned' });
const exerciseById = new Map([
  ['incline-press', buildExercise({ id: 'incline-press', name: 'インクラインダンベルプレス' })],
]);

const renderSection = (
  overrides: Partial<React.ComponentProps<typeof PlannedWorkoutSection>> = {},
) =>
  render(
    <PlannedWorkoutSection
      plannedWorkouts={[planned]}
      workoutExercises={[
        buildWorkoutExercise({ id: 'we1', workoutId: 'plan-1', exerciseId: 'incline-press' }),
      ]}
      visibleSets={[
        buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1', weightKg: 22, reps: 10 }),
      ]}
      exerciseById={exerciseById}
      hasActiveWorkout={false}
      onBegin={jest.fn()}
      onDelete={jest.fn()}
      {...overrides}
    />,
  );

describe('PlannedWorkoutSection', () => {
  it('予定が無ければ何も出さない', () => {
    const { toJSON } = renderSection({ plannedWorkouts: [] });
    expect(toJSON()).toBeNull();
  });

  it('予定の種目とセット内容を出す', () => {
    renderSection();
    expect(screen.getByText('インクラインダンベルプレス')).toBeTruthy();
    expect(screen.getByText('22kg×10')).toBeTruthy();
    expect(screen.getByText('1 種目')).toBeTruthy();
  });

  it('休憩の目安は記録ごとの上書きを優先する', () => {
    renderSection({
      workoutExercises: [
        buildWorkoutExercise({
          id: 'we1',
          workoutId: 'plan-1',
          exerciseId: 'incline-press',
          restSecondsOverride: 90,
        }),
      ],
    });
    expect(screen.getByText('休憩の目安 1:30')).toBeTruthy();
  });

  it('この予定で開始できる', () => {
    const onBegin = jest.fn();
    renderSection({ onBegin });

    fireEvent.press(screen.getByText('この予定で開始'));

    expect(onBegin).toHaveBeenCalledWith('plan-1');
  });

  it('記録中は開始させず、理由を出す', () => {
    renderSection({ hasActiveWorkout: true });
    expect(screen.queryByText('この予定で開始')).toBeNull();
    expect(
      screen.getByText('記録途中のワークアウトを終えると、この予定から始められます。'),
    ).toBeTruthy();
  });

  it('記録中でも予定は破棄できる（どこからも消せない予定を残さない）', () => {
    renderSection({ hasActiveWorkout: true });
    expect(screen.getByText('予定を削除')).toBeTruthy();
  });

  it('削除は確認を挟む', () => {
    const onDelete = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderSection({ onDelete });

    fireEvent.press(screen.getByText('予定を削除'));

    expect(alertSpy).toHaveBeenCalledWith(
      '予定を削除',
      '2026-08-28 の予定を削除します。元に戻せません。',
      expect.any(Array),
    );
    expect(onDelete).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('確認で削除を選ぶと破棄する', () => {
    const onDelete = jest.fn();
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.text === '削除')?.onPress?.();
      });
    renderSection({ onDelete });

    fireEvent.press(screen.getByText('予定を削除'));

    expect(onDelete).toHaveBeenCalledWith('plan-1');
    alertSpy.mockRestore();
  });

  it('予定のメモがあれば出す', () => {
    renderSection({
      plannedWorkouts: [buildWorkout({ ...planned, memo: '胸の日。重量は控えめに' })],
    });
    expect(screen.getByText('胸の日。重量は控えめに')).toBeTruthy();
  });
});
