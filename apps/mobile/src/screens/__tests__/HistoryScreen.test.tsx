import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  buildBodyPart,
  buildExercise,
  buildWorkout,
  buildWorkoutExercise,
  buildWorkoutSet,
} from '../../test-support/factories';
import { formatDate, isoDatePlusDays, startOfWeekIso } from '../../utils/datetime';
import { HistoryScreen } from '../HistoryScreen';

// 期間は実行日を起点に決まる。今週・過去の日付を実行日から組み立てる。
const today = formatDate(new Date());
const thisWeek = startOfWeekIso(new Date());
const longAgo = isoDatePlusDays(today, -200);

const exerciseById = new Map([
  ['bench-press', buildExercise({ id: 'bench-press', name: 'ベンチプレス' })],
  ['squat', buildExercise({ id: 'squat', name: 'スクワット', primaryBodyPartId: 'legs' })],
]);
const bodyPartById = new Map([
  ['chest', buildBodyPart()],
  ['legs', buildBodyPart({ id: 'legs', name: '脚', orderIndex: 2 })],
]);

const thisWeekData = {
  workouts: [buildWorkout({ id: 'w-now', performedAt: today })],
  workoutExercises: [
    buildWorkoutExercise({ id: 'we-now', workoutId: 'w-now', exerciseId: 'bench-press' }),
  ],
  visibleSets: [
    buildWorkoutSet({ id: 's1', workoutExerciseId: 'we-now', weightKg: 60, reps: 10 }),
  ],
};

// 別々の日に1件ずつ。1ヶ月・3ヶ月のどちらの期間にも入る。
const twoPointData = {
  workouts: [
    buildWorkout({ id: 'w1', performedAt: isoDatePlusDays(today, -10) }),
    buildWorkout({ id: 'w2', performedAt: today }),
  ],
  workoutExercises: [
    buildWorkoutExercise({ id: 'we1', workoutId: 'w1' }),
    buildWorkoutExercise({ id: 'we2', workoutId: 'w2' }),
  ],
  visibleSets: [
    buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1' }),
    buildWorkoutSet({ id: 's2', workoutExerciseId: 'we2' }),
  ],
};

const renderScreen = (overrides: Partial<React.ComponentProps<typeof HistoryScreen>> = {}) =>
  render(
    <HistoryScreen
      workouts={[]}
      workoutExercises={[]}
      visibleSets={[]}
      exerciseById={exerciseById}
      bodyPartById={bodyPartById}
      bodyLogs={[]}
      onSelectExercise={jest.fn()}
      {...overrides}
    />,
  );

describe('期間', () => {
  it('既定は今週', () => {
    renderScreen();
    expect(screen.getByText('今週のトレーニング')).toBeTruthy();
  });

  it('期間を切り替えると見出しも変わる', () => {
    renderScreen();

    fireEvent.press(screen.getByText('3ヶ月'));

    expect(screen.getByText('3ヶ月のトレーニング')).toBeTruthy();
  });

  it('期間の外の記録は集計に入れない', () => {
    renderScreen({
      workouts: [buildWorkout({ id: 'w-old', performedAt: longAgo })],
      workoutExercises: [buildWorkoutExercise({ id: 'we-old', workoutId: 'w-old' })],
      visibleSets: [
        buildWorkoutSet({ id: 's-old', workoutExerciseId: 'we-old', weightKg: 99, reps: 10 }),
      ],
    });
    expect(
      screen.getByText(
        'この期間の記録はまだありません。ワークアウトを完了すると、種目ごとの積み上げが並びます。',
      ),
    ).toBeTruthy();
  });
});

describe('期間の集計', () => {
  it('総ボリュームと内訳を出す', () => {
    renderScreen(thisWeekData);
    // 期間の合計と種目別の両方に同じ数字が出るため、存在だけを見る。
    expect(screen.getAllByText('600').length).toBeGreaterThan(0);
    expect(screen.getByText('1回')).toBeTruthy();
  });

  it('部位別の積み上げを出す', () => {
    renderScreen(thisWeekData);
    expect(screen.getByText('胸')).toBeTruthy();
    expect(screen.getByText('1 セット ・ 600kg')).toBeTruthy();
  });
});

describe('種目別', () => {
  it('種目数とボリュームを出し、タップで詳細へ渡す', () => {
    const onSelectExercise = jest.fn();
    renderScreen({ ...thisWeekData, onSelectExercise });

    expect(screen.getByText('1 種目')).toBeTruthy();
    fireEvent.press(screen.getByText('ベンチプレス'));

    expect(onSelectExercise).toHaveBeenCalledWith('bench-press');
  });

  it('BIG3 は推定1RM を添える', () => {
    renderScreen(thisWeekData);
    expect(screen.getByText('推定1RM')).toBeTruthy();
  });

  it('BIG3 以外では推定1RM を出さない', () => {
    renderScreen({
      workouts: [buildWorkout({ id: 'w1', performedAt: today })],
      workoutExercises: [
        buildWorkoutExercise({ id: 'we1', workoutId: 'w1', exerciseId: 'incline-press' }),
      ],
      visibleSets: [buildWorkoutSet({ id: 's1', workoutExerciseId: 'we1' })],
      exerciseById: new Map([
        ['incline-press', buildExercise({ id: 'incline-press', name: 'インクライン' })],
      ]),
    });
    expect(screen.queryByText('推定1RM')).toBeNull();
  });
});

describe('推移グラフ', () => {
  it('1点しか無ければ出さない（線にならない）', () => {
    renderScreen(thisWeekData);
    expect(screen.queryByText('総ボリューム推移')).toBeNull();
  });

  it('2点以上あれば出す', () => {
    renderScreen(twoPointData);

    // 今週の起点は曜日で動くので、1ヶ月へ切り替えてから見る（1点＝1日）。
    fireEvent.press(screen.getByText('1ヶ月'));

    expect(screen.getByText('総ボリューム推移（kg）')).toBeTruthy();
  });

  it('3ヶ月以上は週単位でまとめる', () => {
    renderScreen(twoPointData);

    fireEvent.press(screen.getByText('3ヶ月'));

    expect(screen.getByText('総ボリューム推移（週）（kg）')).toBeTruthy();
  });

  it('体重の記録が2件以上あれば体重推移を出す', () => {
    renderScreen({
      bodyLogs: [
        { id: 'b2', measuredAt: today, bodyWeightKg: 70, bodyFatPercentage: null, memo: '' },
        {
          id: 'b1',
          measuredAt: thisWeek,
          bodyWeightKg: 71,
          bodyFatPercentage: null,
          memo: '',
        },
      ],
    });
    expect(screen.getByText('体重推移（kg）')).toBeTruthy();
  });
});
