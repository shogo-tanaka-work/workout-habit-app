import { render, screen } from '@testing-library/react-native';

import { buildWorkout, buildWorkoutSet } from '../../test-support/factories';
import { summarizeSets } from '../../utils/aggregate';
import { rmDivisorFor } from '../../utils/oneRepMax';
import { RecentSessions } from '../RecentSessions';

const buildSession = (workoutId: string, performedAt: string, exerciseId: string) => {
  const sets = [buildWorkoutSet({ id: `${workoutId}-s1`, weightKg: 60, reps: 10 })];
  return {
    workout: buildWorkout({ id: workoutId, performedAt }),
    sets,
    summary: summarizeSets(sets, rmDivisorFor(exerciseId)),
  };
};

describe('RecentSessions', () => {
  it('初回は次回の目安になると案内する', () => {
    render(<RecentSessions sessions={[]} exerciseId="bench-press" />);
    expect(
      screen.getByText('この種目は初めてです。今日の記録が次回の目安になります。'),
    ).toBeTruthy();
  });

  it('回数つきの見出しと日付を出す', () => {
    render(
      <RecentSessions
        sessions={[
          buildSession('w2', '2026-08-27', 'bench-press'),
          buildSession('w1', '2026-08-20', 'bench-press'),
        ]}
        exerciseId="bench-press"
      />,
    );
    expect(screen.getByText('過去 2 回分の記録')).toBeTruthy();
    expect(screen.getByText('8月27日(木)')).toBeTruthy();
  });

  it('BIG3 は推定1RM を添える', () => {
    render(
      <RecentSessions
        sessions={[buildSession('w1', '2026-08-27', 'bench-press')]}
        exerciseId="bench-press"
      />,
    );
    expect(screen.getByText(/推定1RM/)).toBeTruthy();
  });

  it('BIG3 以外では推定1RM を出さない', () => {
    render(
      <RecentSessions
        sessions={[buildSession('w1', '2026-08-27', 'incline-press')]}
        exerciseId="incline-press"
      />,
    );
    expect(screen.queryByText(/推定1RM/)).toBeNull();
    expect(screen.getByText(/ボリューム 600kg/)).toBeTruthy();
  });
});
