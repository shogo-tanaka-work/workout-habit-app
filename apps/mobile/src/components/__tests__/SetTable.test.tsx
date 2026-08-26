import { render, screen } from '@testing-library/react-native';

import { buildWorkoutSet } from '../../test-support/factories';
import { SetTable } from '../SetTable';

describe('SetTable', () => {
  it('セット番号・重量・レップ数を並べる', () => {
    render(
      <SetTable
        sets={[
          buildWorkoutSet({ id: 's1', weightKg: 60, reps: 10 }),
          buildWorkoutSet({ id: 's2', weightKg: 62.5, reps: 8 }),
        ]}
      />,
    );
    expect(screen.getByText('セット')).toBeTruthy();
    expect(screen.getByText('62.5')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('ウォームアップは番号ではなく W を出す', () => {
    render(<SetTable sets={[buildWorkoutSet({ id: 's1', isWarmup: true })]} />);
    expect(screen.getByText('W')).toBeTruthy();
  });

  it('セットが無くてもラベル列だけで描ける', () => {
    render(<SetTable sets={[]} />);
    expect(screen.getByText('レップ数')).toBeTruthy();
  });
});
