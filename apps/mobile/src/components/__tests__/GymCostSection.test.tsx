import { render, screen } from '@testing-library/react-native';

import { summarizeGymCost } from '../../utils/gymCost';
import { GymCostSection } from '../GymCostSection';

describe('GymCostSection', () => {
  it('1回あたりを主役に、回数と次の1回を添える', () => {
    render(
      <GymCostSection monthlyFeeYen={8000} cost={summarizeGymCost(8000, 4)} monthLabel="8月" />,
    );
    expect(screen.getByText('8月のジム代')).toBeTruthy();
    expect(screen.getByText('月額 8,000円')).toBeTruthy();
    expect(screen.getByText('2,000')).toBeTruthy();
    expect(screen.getByText('4回')).toBeTruthy();
    expect(screen.getByText('あと1回で 1,600円/回')).toBeTruthy();
  });

  it('まだ記録が無い月は「1回行くと」の金額を出す', () => {
    render(
      <GymCostSection monthlyFeeYen={8000} cost={summarizeGymCost(8000, 0)} monthLabel="8月" />,
    );
    expect(
      screen.getByText('この月はまだ記録がありません。1回行くと 8,000円/回 です。'),
    ).toBeTruthy();
  });
});
