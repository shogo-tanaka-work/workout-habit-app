import { act, renderHook } from '@testing-library/react-native';

import { buildTimerState } from '../../test-support/factories';
import type { TimerSettings } from '../../types/domain';
import { DEFAULT_REST_PRESETS } from '../../types/domain';
import { useRestTimer } from '../useRestTimer';

const settings: TimerSettings = {
  soundEnabled: false,
  vibrationEnabled: false,
  restPresets: DEFAULT_REST_PRESETS,
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// DB を渡さない（保存経路は端末側の関心事で、ここで見たいのは時間の進み方）。
const renderTimer = () => renderHook(() => useRestTimer(settings, null));

describe('カウントダウン', () => {
  it('終了時刻を過ぎたら finished になる', () => {
    const { result } = renderTimer();

    act(() => {
      result.current.setTimer(
        buildTimerState({ duration: 2, remaining: 2, endsAt: Date.now() + 2_000 }),
      );
    });
    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(result.current.timer).toMatchObject({ remaining: 0, running: false, finished: true });
  });

  it('走っていないあいだは減らさない', () => {
    const { result } = renderTimer();

    act(() => {
      result.current.setTimer(buildTimerState({ remaining: 60, running: false, endsAt: null }));
    });
    act(() => {
      jest.advanceTimersByTime(5_000);
    });

    expect(result.current.timer?.remaining).toBe(60);
  });
});

describe('終了後の自動クローズ', () => {
  it('終了から3秒でバナーを閉じる', () => {
    const { result } = renderTimer();

    act(() => {
      result.current.setTimer(
        buildTimerState({ remaining: 0, running: false, finished: true, endsAt: null }),
      );
    });
    expect(result.current.timer).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(3_000);
    });

    expect(result.current.timer).toBeNull();
  });

  it('3秒経つ前は残す（鳴ったことに気づける長さを置く）', () => {
    const { result } = renderTimer();

    act(() => {
      result.current.setTimer(
        buildTimerState({ remaining: 0, running: false, finished: true, endsAt: null }),
      );
    });
    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(result.current.timer).not.toBeNull();
  });

  it('走っているあいだは閉じない', () => {
    const { result } = renderTimer();

    act(() => {
      result.current.setTimer(
        buildTimerState({ remaining: 120, endsAt: Date.now() + 120_000 }),
      );
    });
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    expect(result.current.timer).not.toBeNull();
  });

  it('終了前に次の休憩を始めたら、前のタイマーの自動クローズで消さない', () => {
    const { result } = renderTimer();

    act(() => {
      result.current.setTimer(
        buildTimerState({ remaining: 0, running: false, finished: true, endsAt: null }),
      );
    });
    act(() => {
      jest.advanceTimersByTime(2_000);
      result.current.setTimer(
        buildTimerState({ workoutSetId: 'set-2', remaining: 90, endsAt: Date.now() + 90_000 }),
      );
    });
    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(result.current.timer).toMatchObject({ workoutSetId: 'set-2', running: true });
  });
});
