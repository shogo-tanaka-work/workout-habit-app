import { fireEvent, render, screen } from '@testing-library/react-native';

import { PlateCalculator } from '../PlateCalculator';

describe('PlateCalculator', () => {
  it('既定（100kg・オリンピックバー）の組み方を出す', () => {
    render(<PlateCalculator />);
    expect(screen.getByText('25 kg')).toBeTruthy();
    expect(screen.getByText('15 kg')).toBeTruthy();
    expect(screen.getAllByText('× 1')).toHaveLength(2);
    expect(screen.getByText('100 kg')).toBeTruthy();
  });

  it('バーを変えると組み方が変わる', () => {
    render(<PlateCalculator />);

    fireEvent.press(screen.getByText('スタンダードバー 15kg'));

    // (100 - 15) / 2 = 42.5 → 25 + 15 + 2.5
    expect(screen.getByText('2.5 kg')).toBeTruthy();
  });

  it('その他のバーでは重量を自分で入れる', () => {
    render(<PlateCalculator />);

    expect(screen.queryByText('バー重量')).toBeNull();
    fireEvent.press(screen.getByText('その他'));

    expect(screen.getByText('バー重量')).toBeTruthy();
  });

  it('設定重量がバーより軽ければ組めないと伝える', () => {
    render(<PlateCalculator />);

    const input = screen.getByDisplayValue('100');
    fireEvent.changeText(input, '10');
    fireEvent(input, 'endEditing');

    expect(screen.getByText('バーの重量（20 kg）だけで設定重量を超えています。')).toBeTruthy();
  });

  it('バーちょうどならプレートなしと伝える', () => {
    render(<PlateCalculator />);

    const input = screen.getByDisplayValue('100');
    fireEvent.changeText(input, '20');
    fireEvent(input, 'endEditing');

    expect(screen.getByText('プレートなし（バーのみ）です。')).toBeTruthy();
  });

  it('手持ちのプレートで組めない端数を伝える', () => {
    render(<PlateCalculator />);

    const input = screen.getByDisplayValue('100');
    fireEvent.changeText(input, '101');
    fireEvent(input, 'endEditing');

    expect(screen.getByText(/組めないため/)).toBeTruthy();
  });
});
