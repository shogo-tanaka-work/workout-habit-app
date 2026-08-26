import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import {
  buildExercise,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { ExerciseLogSection } from '../ExerciseLogSection';

const workoutExercise = buildWorkoutExercise({ id: 'we1', exerciseId: 'bench-press' });
const sets = [
  buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1', orderIndex: 1, weightKg: 60, reps: 10 }),
  buildWorkoutSet({
    id: 's2',
    workoutExerciseId: 'we1',
    orderIndex: 2,
    weightKg: 40,
    reps: 12,
    isWarmup: true,
  }),
];

const renderSection = (
  overrides: Partial<React.ComponentProps<typeof ExerciseLogSection>> = {},
) =>
  render(
    <ExerciseLogSection
      workoutExercise={workoutExercise}
      exercise={buildExercise()}
      visibleSets={sets}
      onAddSet={jest.fn()}
      onPatchSet={jest.fn()}
      onDeleteExercise={jest.fn()}
      onSaveMemo={jest.fn()}
      {...overrides}
    />,
  );

describe('見出しの集計', () => {
  it('ウォームアップを本数から外し、別枠で数える', () => {
    renderSection();
    // 60×10 = 600kg。ウォームアップ（40×12）は入らない。
    expect(screen.getByText(/1 セット（＋WU 1） ・ 600kg/)).toBeTruthy();
  });

  it('BIG3 は推定1RM を添える', () => {
    renderSection();
    expect(screen.getByText(/推定1RM/)).toBeTruthy();
  });

  it('BIG3 以外では推定1RM を出さない', () => {
    renderSection({
      workoutExercise: buildWorkoutExercise({ id: 'we1', exerciseId: 'incline-press' }),
      exercise: buildExercise({ id: 'incline-press', name: 'インクラインダンベルプレス' }),
    });
    expect(screen.queryByText(/推定1RM/)).toBeNull();
  });

  it('種目が引けなくても見出しを出す', () => {
    renderSection({ exercise: undefined });
    expect(screen.getByText('種目')).toBeTruthy();
  });
});

describe('休憩タイマーの行', () => {
  it('onOpenRestPicker を渡したときだけ出す', () => {
    renderSection();
    expect(screen.queryByText('休憩タイマー')).toBeNull();

    renderSection({ onOpenRestPicker: jest.fn() });
    expect(screen.getByText('休憩タイマー')).toBeTruthy();
  });

  it('種目の既定の休憩秒数を出す', () => {
    renderSection({ onOpenRestPicker: jest.fn(), exercise: buildExercise({ defaultRestSeconds: 90 }) });
    expect(screen.getByText('1:30 ›')).toBeTruthy();
  });

  it('記録ごとの上書きがあればそちらを出す', () => {
    renderSection({
      onOpenRestPicker: jest.fn(),
      workoutExercise: buildWorkoutExercise({ id: 'we1', restSecondsOverride: 200 }),
    });
    expect(screen.getByText('3:20 ›')).toBeTruthy();
  });

  it('押すと画面に出ている秒数のまま開く', () => {
    const onOpenRestPicker = jest.fn();
    renderSection({ onOpenRestPicker });

    fireEvent.press(screen.getByText('休憩タイマー'));

    expect(onOpenRestPicker).toHaveBeenCalledWith(workoutExercise, 120);
  });
});

describe('完了と休憩', () => {
  it('完了を付けるとそのまま休憩に入る', () => {
    const onStartRestTimer = jest.fn();
    const onPatchSet = jest.fn();
    renderSection({ onStartRestTimer, onPatchSet });

    fireEvent.press(screen.getByLabelText('セット 1 を完了'));

    expect(onStartRestTimer).toHaveBeenCalledWith(sets[0], workoutExercise);
    expect(onPatchSet).not.toHaveBeenCalled();
  });

  it('完了を外すときは休憩に入らない', () => {
    const onStartRestTimer = jest.fn();
    const onPatchSet = jest.fn();
    renderSection({
      onStartRestTimer,
      onPatchSet,
      visibleSets: [buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1', isCompleted: true })],
    });

    fireEvent.press(screen.getByLabelText('セット 1 を完了'));

    expect(onStartRestTimer).not.toHaveBeenCalled();
    expect(onPatchSet).toHaveBeenCalledWith('s1', { isCompleted: false });
  });

  it('休憩タイマーを渡さない画面（過去の編集）では完了だけを保存する', () => {
    const onPatchSet = jest.fn();
    renderSection({ onPatchSet });

    fireEvent.press(screen.getByLabelText('セット 1 を完了'));

    expect(onPatchSet).toHaveBeenCalledWith('s1', { isCompleted: true });
  });
});

describe('セットの追加とメモ', () => {
  it('セットを足せる', () => {
    const onAddSet = jest.fn();
    renderSection({ onAddSet });

    fireEvent.press(screen.getByText('＋ セット'));

    expect(onAddSet).toHaveBeenCalledWith(workoutExercise);
  });

  it('メモは確定したときだけ保存する', () => {
    const onSaveMemo = jest.fn();
    renderSection({ onSaveMemo });

    const input = screen.getByPlaceholderText('この種目のメモ');
    fireEvent.changeText(input, '肩に違和感');
    expect(onSaveMemo).not.toHaveBeenCalled();

    fireEvent(input, 'endEditing');
    expect(onSaveMemo).toHaveBeenCalledWith(workoutExercise, '肩に違和感');
  });

  it('変わっていないメモは保存しない', () => {
    const onSaveMemo = jest.fn();
    renderSection({ onSaveMemo });

    fireEvent(screen.getByPlaceholderText('この種目のメモ'), 'endEditing');

    expect(onSaveMemo).not.toHaveBeenCalled();
  });
});

describe('種目の削除', () => {
  it('確認を挟んでから外す', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onDeleteExercise = jest.fn();
    renderSection({ onDeleteExercise });

    fireEvent.press(screen.getByText('削除'));

    expect(alertSpy).toHaveBeenCalledWith(
      'ベンチプレス を削除',
      '2 セットの記録も一緒に消えます。',
      expect.any(Array),
    );
    expect(onDeleteExercise).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('確認で削除を選ぶと外す', () => {
    const onDeleteExercise = jest.fn();
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.text === '削除')?.onPress?.();
      });
    renderSection({ onDeleteExercise });

    fireEvent.press(screen.getByText('削除'));

    expect(onDeleteExercise).toHaveBeenCalledWith(workoutExercise);
    alertSpy.mockRestore();
  });
});
