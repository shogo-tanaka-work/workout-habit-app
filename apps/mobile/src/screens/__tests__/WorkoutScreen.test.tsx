import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  buildBodyPart,
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
} from '../../test-support/factories';
import { WorkoutScreen } from '../WorkoutScreen';

const bench = buildExercise({ id: 'bench-press', name: 'ベンチプレス' });
const incline = buildExercise({ id: 'incline-press', name: 'インクラインダンベルプレス' });
const exerciseById = new Map([
  [bench.id, bench],
  [incline.id, incline],
]);

const renderScreen = (overrides: Partial<React.ComponentProps<typeof WorkoutScreen>> = {}) => {
  const onAddExercise = jest.fn().mockResolvedValue(true);
  const utils = render(
    <WorkoutScreen
      activeWorkout={buildWorkout({ id: 'w1', status: 'active' })}
      workoutExercises={[]}
      visibleSets={[]}
      exercises={[bench, incline]}
      exerciseById={exerciseById}
      bodyParts={[buildBodyPart()]}
      recentSessionsByExerciseId={new Map()}
      lastPerformedByExerciseId={new Map()}
      templates={[]}
      templateExercises={[]}
      onStart={jest.fn()}
      onStartFromTemplate={jest.fn()}
      onSaveTemplate={jest.fn()}
      onDeleteTemplate={jest.fn()}
      onComplete={jest.fn()}
      onPause={jest.fn()}
      onAddExercise={onAddExercise}
      onAddCustomExercise={jest.fn()}
      onAddSet={jest.fn()}
      onPatchSet={jest.fn()}
      onDeleteExercise={jest.fn()}
      onSaveMemo={jest.fn()}
      onStartRestTimer={jest.fn()}
      onOpenRestPicker={jest.fn()}
      {...overrides}
    />,
  );
  return { ...utils, onAddExercise };
};

describe('記録中でないとき', () => {
  it('開始を促す', () => {
    const onStart = jest.fn();
    renderScreen({ activeWorkout: null, onStart });
    fireEvent.press(screen.getByText('ワークアウト開始'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('種目を選ぶ', () => {
  // 記録中の日付の締めは onAddExercise の先（startWorkout）で行う。
  // 追加済みだからと素通しにすると、日をまたいだ記録へ積み続けることになる。
  it('追加済みの種目でも onAddExercise を通す', async () => {
    const { onAddExercise } = renderScreen({
      workoutExercises: [buildWorkoutExercise({ id: 'we1', exerciseId: 'bench-press' })],
    });

    fireEvent.press(screen.getAllByText('ベンチプレス')[0]);

    await waitFor(() => expect(onAddExercise).toHaveBeenCalledWith(bench));
  });

  it('追加に失敗したら種目を開かない', async () => {
    const onAddExercise = jest.fn().mockResolvedValue(false);
    renderScreen({ onAddExercise });

    fireEvent.press(screen.getByText('ベンチプレス'));

    await waitFor(() => expect(onAddExercise).toHaveBeenCalled());
    // 記録パネル（戻る導線）は出ない。
    expect(screen.queryByText('種目を選ぶ')).toBeNull();
  });

  it('追加できたらその種目の記録パネルを開く', async () => {
    // 追加が済んだ状態（記録に種目行がある）を渡す。実アプリでは追加後の
    // 再読み込みでこの props が届き、そこで初めてパネルが開く。
    renderScreen({
      workoutExercises: [buildWorkoutExercise({ id: 'we1', exerciseId: 'bench-press' })],
    });

    fireEvent.press(screen.getAllByText('ベンチプレス')[0]);

    await waitFor(() => expect(screen.getByText('種目を選ぶ')).toBeTruthy());
  });
});

describe('今日のメニュー', () => {
  it('記録に入っている種目を並べる', () => {
    renderScreen({
      workoutExercises: [buildWorkoutExercise({ id: 'we1', exerciseId: 'incline-press' })],
    });
    expect(screen.getByText('今日のメニュー')).toBeTruthy();
    expect(screen.getByText('1 種目')).toBeTruthy();
  });

  it('同じ種目が複数行あってもメニューには1行だけ出す', () => {
    renderScreen({
      workoutExercises: [
        buildWorkoutExercise({ id: 'we1', exerciseId: 'incline-press', orderIndex: 1 }),
        buildWorkoutExercise({ id: 'we2', exerciseId: 'incline-press', orderIndex: 2 }),
      ],
    });
    expect(screen.getByText('1 種目')).toBeTruthy();
  });

  it('マスタから引けない種目は並べない', () => {
    renderScreen({
      workoutExercises: [buildWorkoutExercise({ id: 'we1', exerciseId: 'gone' })],
    });
    expect(screen.queryByText('今日のメニュー')).toBeNull();
  });
});
