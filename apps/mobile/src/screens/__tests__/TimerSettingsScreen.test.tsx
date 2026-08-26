import { fireEvent, render, screen } from '@testing-library/react-native';

import type { TimerSettings } from '../../types/domain';
import { TimerSettingsScreen } from '../TimerSettingsScreen';

const settings: TimerSettings = {
  soundEnabled: true,
  vibrationEnabled: false,
  restPresets: [120, 180],
};

const renderScreen = (overrides: Partial<TimerSettings> = {}) => {
  const onUpdate = jest.fn();
  render(
    <TimerSettingsScreen timerSettings={{ ...settings, ...overrides }} onUpdate={onUpdate} />,
  );
  return { onUpdate };
};

describe('終了通知', () => {
  // スイッチは音・振動の順に並ぶ（画面の並びと同じ）。
  it('音の設定を切り替える', () => {
    const { onUpdate } = renderScreen();

    fireEvent(screen.getAllByRole('switch')[0], 'valueChange', false);

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ soundEnabled: false }));
  });

  it('振動の設定を切り替える', () => {
    const { onUpdate } = renderScreen();

    fireEvent(screen.getAllByRole('switch')[1], 'valueChange', true);

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ vibrationEnabled: true }));
  });

  it('片方を変えても、もう片方の設定を保つ', () => {
    const { onUpdate } = renderScreen();

    fireEvent(screen.getAllByRole('switch')[0], 'valueChange', false);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ vibrationEnabled: false, restPresets: [120, 180] }),
    );
  });
});

describe('共通タイマー', () => {
  it('件数と上限を出す', () => {
    renderScreen();
    expect(screen.getByText('2 / 3 件')).toBeTruthy();
  });

  it('選んだ時間を30秒ずつ動かす', () => {
    const { onUpdate } = renderScreen();

    fireEvent.press(screen.getByText('+'));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ restPresets: [150, 180] }),
    );
  });

  it('チップで対象を選び直せる', () => {
    const { onUpdate } = renderScreen();

    fireEvent.press(screen.getByText('3:00'));
    fireEvent.press(screen.getByText('-'));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ restPresets: [120, 150] }),
    );
  });

  it('30秒より短くしない', () => {
    const { onUpdate } = renderScreen({ restPresets: [30] });

    fireEvent.press(screen.getByText('-'));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ restPresets: [30] }));
  });

  it('選択中の値を複製して足す', () => {
    const { onUpdate } = renderScreen();

    fireEvent.press(screen.getByText('＋ 追加'));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ restPresets: [120, 180, 120] }),
    );
  });

  it('上限に達したら追加させない', () => {
    const { onUpdate } = renderScreen({ restPresets: [120, 180, 240] });

    fireEvent.press(screen.getByText('＋ 追加'));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('最後の1件は消させない', () => {
    const { onUpdate } = renderScreen({ restPresets: [120] });

    fireEvent.press(screen.getByText('− 削除'));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('選んだ時間を消す', () => {
    const { onUpdate } = renderScreen();

    fireEvent.press(screen.getByText('− 削除'));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ restPresets: [180] }));
  });
});
