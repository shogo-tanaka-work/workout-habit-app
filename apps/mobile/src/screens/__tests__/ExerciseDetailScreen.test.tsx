import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  buildExercise,
  buildWorkout,
  buildWorkoutSet,
} from '../../test-support/factories';
import type { ExerciseSession } from '../../utils/aggregate';
import { summarizeSets } from '../../utils/aggregate';
import { formatDate, isoDateMonthsAgo } from '../../utils/datetime';
import { rmDivisorFor } from '../../utils/oneRepMax';
import { ExerciseDetailScreen } from '../ExerciseDetailScreen';

const today = formatDate(new Date());
const twoMonthsAgo = isoDateMonthsAgo(2, new Date());
const twoYearsAgo = isoDateMonthsAgo(24, new Date());

const buildSession = (
  id: string,
  performedAt: string,
  exerciseId: string,
  weightKg = 60,
): ExerciseSession => {
  const sets = [
    buildWorkoutSet({ id: `${id}-s1`, weightKg, reps: 10 }),
    buildWorkoutSet({ id: `${id}-s2`, orderIndex: 2, weightKg, reps: 8 }),
  ];
  return {
    workout: buildWorkout({ id, performedAt }),
    sets,
    summary: summarizeSets(sets, rmDivisorFor(exerciseId)),
  };
};

describe('記録が無いとき', () => {
  it('この画面で何が見られるかを案内する', () => {
    render(<ExerciseDetailScreen exercise={buildExercise()} sessions={[]} />);
    expect(screen.getByText('まだ記録がありません')).toBeTruthy();
  });

  it('BIG3 なら記録が無くても RM計算機は出す', () => {
    render(<ExerciseDetailScreen exercise={buildExercise()} sessions={[]} />);
    expect(screen.getByText('RM計算機')).toBeTruthy();
  });

  it('BIG3 以外では RM計算機を出さない', () => {
    render(
      <ExerciseDetailScreen
        exercise={buildExercise({ id: 'incline-press', name: 'インクライン' })}
        sessions={[]}
      />,
    );
    expect(screen.queryByText('RM計算機')).toBeNull();
  });
});

describe('実施の一覧', () => {
  const sessions = [
    buildSession('w3', today, 'bench-press'),
    buildSession('w2', twoMonthsAgo, 'bench-press'),
  ];

  it('直近の実施を先頭に、過去の記録をまとめる', () => {
    render(<ExerciseDetailScreen exercise={buildExercise()} sessions={sessions} />);
    expect(screen.getByText('過去の記録')).toBeTruthy();
    expect(screen.getByText('直近 1 回')).toBeTruthy();
  });

  it('1回だけなら過去の記録の欄を出さない', () => {
    render(<ExerciseDetailScreen exercise={buildExercise()} sessions={[sessions[0]]} />);
    expect(screen.queryByText('過去の記録')).toBeNull();
  });
});

describe('推移の期間', () => {
  const sessions = [
    buildSession('w2', today, 'bench-press'),
    buildSession('w1', twoMonthsAgo, 'bench-press', 50),
  ];

  it('既定は3ヶ月で、その期間の集計を出す', () => {
    render(<ExerciseDetailScreen exercise={buildExercise()} sessions={sessions} />);
    // 60×10 + 60×8 = 1,080 と 50×10 + 50×8 = 900 の合計。
    expect(screen.getByText('1,980')).toBeTruthy();
    expect(screen.getByText('2回')).toBeTruthy();
  });

  it('期間を絞ると集計から外れる', () => {
    render(<ExerciseDetailScreen exercise={buildExercise()} sessions={sessions} />);

    fireEvent.press(screen.getByText('1ヶ月'));

    // 期間の合計と、直近の実施のボリュームが同じ数字になる。
    expect(screen.getAllByText('1,080').length).toBeGreaterThan(0);
    expect(screen.getByText('1回')).toBeTruthy();
    expect(screen.queryByText('1,980')).toBeNull();
  });

  it('期間の外だけなら推移は描かない', () => {
    render(
      <ExerciseDetailScreen
        exercise={buildExercise()}
        sessions={[buildSession('w-old', twoYearsAgo, 'bench-press')]}
      />,
    );
    expect(
      screen.getAllByText('記録が2回以上たまると推移を表示します。').length,
    ).toBeGreaterThan(0);
  });

  it('BIG3 は推定1RM の推移も出す', () => {
    render(<ExerciseDetailScreen exercise={buildExercise()} sessions={sessions} />);
    expect(screen.getByText('推定1RM推移（kg）')).toBeTruthy();
  });

  it('BIG3 以外では推定1RM の推移を出さない', () => {
    const inclineSessions = [
      buildSession('w2', today, 'incline-press'),
      buildSession('w1', twoMonthsAgo, 'incline-press'),
    ];
    render(
      <ExerciseDetailScreen
        exercise={buildExercise({ id: 'incline-press', name: 'インクライン' })}
        sessions={inclineSessions}
      />,
    );
    expect(screen.queryByText('推定1RM推移（kg）')).toBeNull();
    expect(screen.getByText('ボリューム推移（kg）')).toBeTruthy();
  });
});

describe('RM計算機', () => {
  it('直近のベストセットを初期値にする', () => {
    render(
      <ExerciseDetailScreen
        exercise={buildExercise()}
        sessions={[buildSession('w1', today, 'bench-press')]}
      />,
    );
    // 60kg × 10（ベンチプレスは ÷40）→ 60 * (1 + 10/40) = 75
    expect(screen.getByText('推定1RM 75 kg')).toBeTruthy();
  });

  it('重量を変えると推定1RMと目安重量が変わる', () => {
    render(
      <ExerciseDetailScreen
        exercise={buildExercise()}
        sessions={[buildSession('w1', today, 'bench-press')]}
      />,
    );

    const weightInput = screen.getByDisplayValue('60');
    fireEvent.changeText(weightInput, '80');
    fireEvent(weightInput, 'endEditing');

    // 80 * (1 + 10/40) = 100
    expect(screen.getByText('推定1RM 100 kg')).toBeTruthy();
  });

  it('換算式の根拠を添える', () => {
    render(
      <ExerciseDetailScreen
        exercise={buildExercise()}
        sessions={[buildSession('w1', today, 'bench-press')]}
      />,
    );
    expect(screen.getByText(/FWJ/)).toBeTruthy();
  });
});
