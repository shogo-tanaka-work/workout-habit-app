import { fireEvent, render, screen } from '@testing-library/react-native';

import { SettingsScreen, SETTINGS_TITLES } from '../SettingsScreen';

describe('SettingsScreen', () => {
  it('用途ごとの見出しでメニューを分ける', () => {
    render(<SettingsScreen onOpen={jest.fn()} />);
    expect(screen.getByText('マスタ管理')).toBeTruthy();
    expect(screen.getByText('ツール')).toBeTruthy();
    expect(screen.getByText('設定')).toBeTruthy();
    expect(screen.getByText('データ')).toBeTruthy();
  });

  it('すべてのサブ画面へ入口がある', () => {
    render(<SettingsScreen onOpen={jest.fn()} />);
    for (const title of Object.values(SETTINGS_TITLES)) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('行を押すとその画面を開く', () => {
    const onOpen = jest.fn();
    render(<SettingsScreen onOpen={onOpen} />);

    fireEvent.press(screen.getByText(SETTINGS_TITLES.timer));

    expect(onOpen).toHaveBeenCalledWith('timer');
  });

  it('ジムの月額料金の入口はトレーニング設定にある', () => {
    render(<SettingsScreen onOpen={jest.fn()} />);
    expect(screen.getByText(/ジムの月額料金/)).toBeTruthy();
  });
});
