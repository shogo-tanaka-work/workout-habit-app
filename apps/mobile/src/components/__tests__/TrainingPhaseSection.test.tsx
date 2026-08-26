import { fireEvent, render, screen } from '@testing-library/react-native';

import type { TrainingPhase } from '../../types/domain';
import { formatDate } from '../../utils/datetime';
import { TrainingPhaseSection } from '../TrainingPhaseSection';

const today = formatDate(new Date());

const buildPhase = (overrides: Partial<TrainingPhase> = {}): TrainingPhase => ({
  id: 'phase-1',
  phase: 'cut',
  startedOn: today,
  endedOn: null,
  note: '断酒中',
  ...overrides,
});

describe('現在のフェーズ', () => {
  it('未設定なら切り替えを促す', () => {
    render(<TrainingPhaseSection currentPhase={null} onSwitch={jest.fn()} />);
    expect(screen.getByText('未設定')).toBeTruthy();
    expect(
      screen.getByText('フェーズはまだありません。下で選んで切り替えると、ここに出ます。'),
    ).toBeTruthy();
  });

  it('進行中のフェーズと経過日数を出す', () => {
    render(<TrainingPhaseSection currentPhase={buildPhase()} onSwitch={jest.fn()} />);
    expect(screen.getByText('減量期・進行中')).toBeTruthy();
    // 開始当日は1日目。
    expect(screen.getByText(new RegExp(`${today}〜（1日目）`))).toBeTruthy();
  });

  it('方針のメモがあれば出す', () => {
    render(<TrainingPhaseSection currentPhase={buildPhase()} onSwitch={jest.fn()} />);
    expect(screen.getByText('断酒中')).toBeTruthy();
  });

  it('契約外のフェーズ値でも画面を壊さない', () => {
    render(
      <TrainingPhaseSection currentPhase={buildPhase({ phase: 'unknown' })} onSwitch={jest.fn()} />,
    );
    expect(screen.getByText('フェーズ・進行中')).toBeTruthy();
  });
});

describe('切り替え', () => {
  it('進行中のフェーズを初期選択にする', () => {
    const onSwitch = jest.fn();
    render(
      <TrainingPhaseSection currentPhase={buildPhase({ phase: 'bulk' })} onSwitch={onSwitch} />,
    );

    fireEvent.press(screen.getByText('このフェーズに切り替える'));

    expect(onSwitch).toHaveBeenCalledWith({ phase: 'bulk', startedOn: today, note: '' });
  });

  it('未設定のときは減量期を初期選択にする', () => {
    const onSwitch = jest.fn();
    render(<TrainingPhaseSection currentPhase={null} onSwitch={onSwitch} />);

    fireEvent.press(screen.getByText('このフェーズに切り替える'));

    expect(onSwitch).toHaveBeenCalledWith({ phase: 'cut', startedOn: today, note: '' });
  });

  it('フェーズと方針を選んで切り替える', () => {
    const onSwitch = jest.fn();
    render(<TrainingPhaseSection currentPhase={null} onSwitch={onSwitch} />);

    fireEvent.press(screen.getByText('リーンバルク'));
    fireEvent.changeText(
      screen.getByPlaceholderText('このフェーズの方針（例: 断酒中・回復優先）'),
      '  回復優先 ',
    );
    fireEvent.press(screen.getByText('このフェーズに切り替える'));

    expect(onSwitch).toHaveBeenCalledWith({
      phase: 'lean_bulk',
      startedOn: today,
      note: '回復優先',
    });
  });

  it('開始日を選び直せる', () => {
    const onSwitch = jest.fn();
    render(<TrainingPhaseSection currentPhase={null} onSwitch={onSwitch} />);

    fireEvent.press(screen.getByText(today));
    fireEvent.press(screen.getByText('15'));
    fireEvent.press(screen.getByText('決定'));
    fireEvent.press(screen.getByText('このフェーズに切り替える'));

    expect(onSwitch).toHaveBeenCalledWith(
      expect.objectContaining({ startedOn: `${today.slice(0, 7)}-15` }),
    );
  });

  it('前のフェーズが自動で終わることを押す前に伝える', () => {
    render(<TrainingPhaseSection currentPhase={buildPhase()} onSwitch={jest.fn()} />);
    expect(
      screen.getByText('切り替えると、進行中のフェーズは開始日の前日で自動的に終了します。'),
    ).toBeTruthy();
  });
});
