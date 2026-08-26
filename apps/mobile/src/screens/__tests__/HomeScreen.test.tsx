import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { formatDate, isoDatePlusDays } from '../../utils/datetime';
import { HomeScreen } from '../HomeScreen';

// ホームは常に「今日」を選んだ状態で開く。実行日に左右されないようここから組み立てる。
const today = formatDate(new Date());
const tomorrow = isoDatePlusDays(today, 1);
// 前月の 15 日は、実行日が月初でも月末でも「過去日」になる。
const lastMonth = formatDate(
  new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 15),
).slice(0, 7);

const exerciseById = new Map([['bench-press', buildExercise()]]);

const renderScreen = (overrides: Partial<React.ComponentProps<typeof HomeScreen>> = {}) =>
  render(
    <HomeScreen
      activeWorkout={null}
      completedWorkouts={[]}
      plannedWorkouts={[]}
      workoutExercises={[]}
      visibleSets={[]}
      exerciseById={exerciseById}
      bodyLogs={[]}
      gymMonthlyFeeYen={null}
      onResume={jest.fn()}
      onBeginPlanned={jest.fn()}
      onDeletePlanned={jest.fn()}
      onEditWorkout={jest.fn()}
      onAddPastWorkout={jest.fn()}
      onSelectExercise={jest.fn()}
      onSaveBodyLog={jest.fn()}
      {...overrides}
    />,
  );

const completedToday = {
  completedWorkouts: [buildWorkout({ id: 'w1', performedAt: today })],
  workoutExercises: [buildWorkoutExercise({ id: 'we1', workoutId: 'w1' })],
  visibleSets: [
    buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1', weightKg: 60, reps: 10 }),
    buildWorkoutSet({ id: 's2', workoutExerciseId: 'we1', orderIndex: 2, weightKg: 60, reps: 8 }),
  ],
};

describe('選んだ日の記録', () => {
  it('今日を選んだ状態で開く', () => {
    renderScreen();
    expect(screen.getByText(/（今日）/)).toBeTruthy();
  });

  it('その日の種目・セット・集計を出す', () => {
    renderScreen(completedToday);
    expect(screen.getByText('ベンチプレス')).toBeTruthy();
    expect(screen.getByText('2 セット')).toBeTruthy();
    expect(screen.getByText('60kg×10 / 60kg×8')).toBeTruthy();
    // 60×10 + 60×8 = 1,080kg
    expect(screen.getByText('1,080')).toBeTruthy();
  });

  it('種目をタップすると種目詳細を開く', () => {
    const onSelectExercise = jest.fn();
    renderScreen({ ...completedToday, onSelectExercise });

    fireEvent.press(screen.getByText('ベンチプレス'));

    expect(onSelectExercise).toHaveBeenCalledWith('bench-press');
  });

  it('記録中のワークアウトも当日の記録として扱う', () => {
    renderScreen({
      activeWorkout: buildWorkout({ id: 'w1', performedAt: today, status: 'active' }),
      workoutExercises: [buildWorkoutExercise({ id: 'we1', workoutId: 'w1' })],
      visibleSets: [buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1' })],
    });
    expect(screen.getByText('記録中を編集')).toBeTruthy();
    expect(screen.getByText('途中の記録を再開')).toBeTruthy();
  });

  it('編集から記録を開く', () => {
    const onEditWorkout = jest.fn();
    renderScreen({ ...completedToday, onEditWorkout });

    fireEvent.press(screen.getByText('編集'));

    expect(onEditWorkout).toHaveBeenCalledWith('w1');
  });
});

describe('記録が無い日', () => {
  it('今日なら記録の始め方を案内する', () => {
    renderScreen();
    expect(
      screen.getByText('この日の記録はまだありません。右下の＋から記録を始めましょう。'),
    ).toBeTruthy();
  });

  // 月初・月末でも成り立つよう、前月／翌月へ送ってから日を選ぶ。
  it('過去日なら後から入れられると案内し、追加の導線を出す', () => {
    const onAddPastWorkout = jest.fn();
    renderScreen({ onAddPastWorkout });

    fireEvent.press(screen.getByText('‹'));
    fireEvent.press(screen.getByText('15'));

    expect(
      screen.getByText('この日の記録はありません。あとから入れ直すこともできます。'),
    ).toBeTruthy();
    fireEvent.press(screen.getByText('この日の記録を追加'));
    expect(onAddPastWorkout).toHaveBeenCalledWith(`${lastMonth}-15`);
  });

  it('未来日には記録を作らせない', () => {
    renderScreen();

    fireEvent.press(screen.getByText('›'));
    fireEvent.press(screen.getByText('15'));

    expect(screen.queryByText('この日の記録を追加')).toBeNull();
  });

  it('種目が入っていない記録では編集を促す', () => {
    renderScreen({
      completedWorkouts: [buildWorkout({ id: 'w1', performedAt: today })],
    });
    expect(
      screen.getByText(
        'この記録にはまだ種目が入っていません。「編集」から種目とセットを足せます。',
      ),
    ).toBeTruthy();
  });
});

describe('予定', () => {
  it('選んだ日の予定だけを出す', () => {
    renderScreen({
      plannedWorkouts: [
        buildWorkout({ id: 'plan-today', performedAt: today, status: 'planned' }),
        buildWorkout({ id: 'plan-tomorrow', performedAt: tomorrow, status: 'planned' }),
      ],
      workoutExercises: [
        buildWorkoutExercise({ id: 'we-today', workoutId: 'plan-today' }),
        buildWorkoutExercise({ id: 'we-tomorrow', workoutId: 'plan-tomorrow' }),
      ],
    });
    expect(screen.getAllByText('予定しているメニュー')).toHaveLength(1);
  });

  it('予定から開始できる', () => {
    const onBeginPlanned = jest.fn();
    renderScreen({
      plannedWorkouts: [buildWorkout({ id: 'plan-1', performedAt: today, status: 'planned' })],
      workoutExercises: [buildWorkoutExercise({ id: 'we1', workoutId: 'plan-1' })],
      onBeginPlanned,
    });

    fireEvent.press(screen.getByText('この予定で開始'));

    expect(onBeginPlanned).toHaveBeenCalledWith('plan-1');
  });
});

describe('ジム代', () => {
  it('月額が未設定なら出さない', () => {
    renderScreen(completedToday);
    expect(screen.queryByText(/のジム代/)).toBeNull();
  });

  it('選んだ日の月で1回あたりを出す', () => {
    renderScreen({ ...completedToday, gymMonthlyFeeYen: 8000 });
    const month = Number(today.slice(5, 7));
    expect(screen.getByText(`${month}月のジム代`)).toBeTruthy();
    // 記録がある日は1日ぶん。8000 / 1 = 8,000円。
    expect(screen.getByText('8,000')).toBeTruthy();
  });
});

describe('ボディログ', () => {
  it('選んだ日の記録として保存する', () => {
    const onSaveBodyLog = jest.fn();
    renderScreen({
      bodyLogs: [
        {
          id: 'b1',
          measuredAt: today,
          bodyWeightKg: 70,
          bodyFatPercentage: 18,
          memo: '',
        },
      ],
      onSaveBodyLog,
    });

    fireEvent.press(screen.getByText('上書き保存'));

    expect(onSaveBodyLog).toHaveBeenCalledWith(today, 70, 18);
  });
});
