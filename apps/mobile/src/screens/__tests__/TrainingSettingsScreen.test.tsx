import { fireEvent, render, screen } from '@testing-library/react-native';

import type { UserProfile } from '../../types/domain';
import { TrainingSettingsScreen } from '../TrainingSettingsScreen';

const profile: UserProfile = {
  id: 'profile-1',
  trainingGoal: 'hypertrophy',
  heightCm: 172,
  gymMonthlyFeeYen: 8000,
  note: '火木土に通う',
};

const renderScreen = (
  overrides: Partial<React.ComponentProps<typeof TrainingSettingsScreen>> = {},
) => {
  const onSaveProfile = jest.fn();
  render(
    <TrainingSettingsScreen
      userProfile={null}
      currentPhase={null}
      onSaveProfile={onSaveProfile}
      onSwitchPhase={jest.fn()}
      {...overrides}
    />,
  );
  return { onSaveProfile };
};

describe('基本情報', () => {
  it('保存前は未設定と出す', () => {
    renderScreen();
    // 基本情報とフェーズの2か所（この画面はどちらも未設定から始まる）。
    expect(screen.getAllByText('未設定')).toHaveLength(2);
  });

  it('保存済みならそう出す', () => {
    renderScreen({ userProfile: profile });
    expect(screen.getByText('保存済み')).toBeTruthy();
  });

  it('保存済みの値を初期値にする', () => {
    renderScreen({ userProfile: profile });
    expect(screen.getByDisplayValue('172')).toBeTruthy();
    expect(screen.getByDisplayValue('8000')).toBeTruthy();
    expect(screen.getByDisplayValue('火木土に通う')).toBeTruthy();
  });

  it('契約外の目的が保存されていても既定へ落とす', () => {
    const { onSaveProfile } = renderScreen({
      userProfile: { ...profile, trainingGoal: 'unknown' },
    });

    fireEvent.press(screen.getByText('基本情報を保存'));

    expect(onSaveProfile).toHaveBeenCalledWith(expect.objectContaining({ trainingGoal: 'general' }));
  });

  it('目的を選んで保存する', () => {
    const { onSaveProfile } = renderScreen();

    fireEvent.press(screen.getByText('筋力向上'));
    fireEvent.press(screen.getByText('基本情報を保存'));

    expect(onSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ trainingGoal: 'strength' }),
    );
  });

  it('身長と月額が 0 のままなら未設定として保存する', () => {
    const { onSaveProfile } = renderScreen();

    fireEvent.press(screen.getByText('基本情報を保存'));

    expect(onSaveProfile).toHaveBeenCalledWith({
      trainingGoal: 'general',
      heightCm: null,
      gymMonthlyFeeYen: null,
      note: '',
    });
  });

  it('月額は 500 円ずつ動かす', () => {
    const { onSaveProfile } = renderScreen({ userProfile: profile });

    // 「+」は身長・月額の2つ。月額は後ろ側。
    const plusButtons = screen.getAllByText('+');
    fireEvent.press(plusButtons[plusButtons.length - 1]);
    fireEvent.press(screen.getByText('基本情報を保存'));

    expect(onSaveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ gymMonthlyFeeYen: 8500 }),
    );
  });

  it('メモの前後の空白を落とす', () => {
    const { onSaveProfile } = renderScreen();

    fireEvent.changeText(
      screen.getByPlaceholderText('制約や方針（例: 火木土に通う・腰に不安）'),
      '  腰に不安 ',
    );
    fireEvent.press(screen.getByText('基本情報を保存'));

    expect(onSaveProfile).toHaveBeenCalledWith(expect.objectContaining({ note: '腰に不安' }));
  });
});

describe('フェーズ', () => {
  it('同じ画面からフェーズも切り替えられる', () => {
    renderScreen();
    expect(screen.getByText('現在のフェーズ')).toBeTruthy();
  });
});
