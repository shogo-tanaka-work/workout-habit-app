import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import {
  buildBodyPart,
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { WorkoutEditScreen } from '../WorkoutEditScreen';

const exerciseById = new Map([['bench-press', buildExercise()]]);

const renderScreen = (overrides: Partial<React.ComponentProps<typeof WorkoutEditScreen>> = {}) =>
  render(
    <WorkoutEditScreen
      workout={buildWorkout({ id: 'w1', performedAt: '2026-08-27' })}
      workoutExercises={[buildWorkoutExercise({ id: 'we1', workoutId: 'w1' })]}
      visibleSets={[
        buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1', weightKg: 60, reps: 10 }),
      ]}
      exercises={[buildExercise()]}
      bodyParts={[buildBodyPart()]}
      exerciseById={exerciseById}
      onAddExercise={jest.fn()}
      onAddCustomExercise={jest.fn()}
      onAddSet={jest.fn()}
      onPatchSet={jest.fn()}
      onDeleteExercise={jest.fn()}
      onSaveMemo={jest.fn()}
      onStartRestTimer={jest.fn()}
      onOpenRestPicker={jest.fn()}
      onChangeDate={jest.fn()}
      onDeleteWorkout={jest.fn()}
      {...overrides}
    />,
  );

describe('見出しと集計', () => {
  it('実施日と、その日ぶんの集計を出す', () => {
    renderScreen();
    expect(screen.getByText('8月27日(木) ›')).toBeTruthy();
    expect(screen.getByText('600')).toBeTruthy();
  });

  it('記録中のワークアウトだと分かるようにする', () => {
    renderScreen({ workout: buildWorkout({ id: 'w1', status: 'active' }) });
    expect(screen.getByText('記録中のワークアウト')).toBeTruthy();
  });

  it('過去の記録では記録中の表示を出さない', () => {
    renderScreen();
    expect(screen.queryByText('記録中のワークアウト')).toBeNull();
  });

  it('種目が無ければ追加の導線を案内する', () => {
    renderScreen({ workoutExercises: [], visibleSets: [] });
    expect(
      screen.getByText('この記録に種目が入っていません。下の「種目を追加」から入れられます。'),
    ).toBeTruthy();
  });
});

describe('実施日の付け替え', () => {
  it('日を選び直すと保存する', () => {
    const onChangeDate = jest.fn();
    renderScreen({ onChangeDate });

    fireEvent.press(screen.getByText('実施日'));
    fireEvent.press(screen.getByText('20'));
    fireEvent.press(screen.getByText('決定'));

    expect(onChangeDate).toHaveBeenCalledWith('w1', '2026-08-20');
  });

  it('同じ日を選んだときは保存しない', () => {
    const onChangeDate = jest.fn();
    renderScreen({ onChangeDate });

    fireEvent.press(screen.getByText('実施日'));
    fireEvent.press(screen.getByText('決定'));

    expect(onChangeDate).not.toHaveBeenCalled();
  });
});

describe('種目の追加', () => {
  it('開いてから選ぶ（直したいセットを押し下げない）', () => {
    const onAddExercise = jest.fn();
    renderScreen({ onAddExercise });

    // 開く前は一覧の行が無い（記録カードの見出しだけ）。
    expect(screen.getAllByText('ベンチプレス')).toHaveLength(1);

    fireEvent.press(screen.getByText('＋ 種目を選ぶ'));
    fireEvent.press(screen.getAllByText('ベンチプレス')[1]);

    expect(onAddExercise).toHaveBeenCalledWith(buildExercise());
  });

  it('選んだら一覧を閉じる', () => {
    renderScreen();

    fireEvent.press(screen.getByText('＋ 種目を選ぶ'));
    fireEvent.press(screen.getAllByText('ベンチプレス')[1]);

    expect(screen.getByText('＋ 種目を選ぶ')).toBeTruthy();
  });
});

describe('記録の削除', () => {
  it('確認を挟む', () => {
    const onDeleteWorkout = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderScreen({ onDeleteWorkout });

    fireEvent.press(screen.getByText('この記録を削除'));

    expect(alertSpy).toHaveBeenCalledWith(
      '記録を削除',
      '2026-08-27 の記録を削除します。元に戻せません。',
      expect.any(Array),
    );
    expect(onDeleteWorkout).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('確認で削除を選ぶと消す', () => {
    const onDeleteWorkout = jest.fn();
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_title, _message, buttons) => {
        buttons?.find((button) => button.text === '削除')?.onPress?.();
      });
    renderScreen({ onDeleteWorkout });

    fireEvent.press(screen.getByText('この記録を削除'));

    expect(onDeleteWorkout).toHaveBeenCalledWith('w1');
    alertSpy.mockRestore();
  });
});
