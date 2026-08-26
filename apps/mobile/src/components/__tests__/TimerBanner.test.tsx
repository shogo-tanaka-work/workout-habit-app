import { fireEvent, render, screen } from '@testing-library/react-native';
import type { Dispatch, SetStateAction } from 'react';

import { buildTimerState } from '../../test-support/factories';
import type { TimerState } from '../../types/domain';
import { TimerBanner } from '../TimerBanner';

type SetTimer = Dispatch<SetStateAction<TimerState | null>>;

const createSetTimer = () => jest.fn<void, Parameters<SetTimer>>();

// バナーは更新関数を渡す（他の更新と競合しないように）。
// 渡された関数を現在値へ適用して、結果の状態を取り出す。
const applyLastUpdate = (
  setTimer: ReturnType<typeof createSetTimer>,
  current: TimerState,
): TimerState | null => {
  const update = setTimer.mock.calls[0][0];
  return typeof update === 'function' ? update(current) : update;
};

describe('TimerBanner', () => {
  it('走っているあいだは残り時間と種目名を出す', () => {
    render(<TimerBanner timer={buildTimerState({ remaining: 95 })} setTimer={createSetTimer()} />);
    expect(screen.getByText('休憩タイマー')).toBeTruthy();
    expect(screen.getByText('ベンチプレス')).toBeTruthy();
    expect(screen.getByText('1:35')).toBeTruthy();
  });

  it('終了したら見出しを変える', () => {
    render(
      <TimerBanner
        timer={buildTimerState({ remaining: 0, running: false, finished: true })}
        setTimer={createSetTimer()}
      />,
    );
    expect(screen.getByText('休憩終了')).toBeTruthy();
    expect(screen.getByText('0:00')).toBeTruthy();
  });

  it('一時停止で終了時刻を捨てる', () => {
    const setTimer = createSetTimer();
    const timer = buildTimerState({ remaining: 60, endsAt: 1_000 });
    render(<TimerBanner timer={timer} setTimer={setTimer} />);

    fireEvent.press(screen.getByText('一時停止'));

    expect(applyLastUpdate(setTimer, timer)).toMatchObject({ running: false, endsAt: null });
  });

  it('再開で残り時間から終了時刻を引き直す', () => {
    const setTimer = createSetTimer();
    const timer = buildTimerState({ remaining: 60, running: false, endsAt: null });
    render(<TimerBanner timer={timer} setTimer={setTimer} />);

    fireEvent.press(screen.getByText('再開'));

    const next = applyLastUpdate(setTimer, timer);
    expect(next?.running).toBe(true);
    expect(next?.endsAt).not.toBeNull();
  });

  it('終了後は再開の操作を効かせない', () => {
    const setTimer = createSetTimer();
    const timer = buildTimerState({ remaining: 0, running: false, finished: true });
    render(<TimerBanner timer={timer} setTimer={setTimer} />);

    fireEvent.press(screen.getByText('再開'));

    expect(applyLastUpdate(setTimer, timer)).toBe(timer);
  });

  it('閉じるでタイマーを捨てる', () => {
    const setTimer = createSetTimer();
    render(<TimerBanner timer={buildTimerState()} setTimer={setTimer} />);

    fireEvent.press(screen.getByText('閉じる'));

    expect(setTimer).toHaveBeenCalledWith(null);
  });
});
