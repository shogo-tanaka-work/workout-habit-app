import { useAudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';

import timerCompleteSound from '../../assets/timer-complete.wav';
import type { TimerSettings, TimerState } from '../types/domain';

// 休憩タイマーの状態とカウントダウン・完了通知（振動＋音）を管理するフック。
// 音・振動の有効/無効は settings（種目タブのタイマー設定）に従う。
// タイマーの「開始」に伴う DB 書き込みは useWorkoutData 側（beginRestTimer）が担う。
export function useRestTimer(settings: TimerSettings) {
  const timerPlayer = useAudioPlayer(timerCompleteSound);
  const [timer, setTimer] = useState<TimerState | null>(null);
  // 現在の計測ですでに完了通知を鳴らしたか。新しい計測の開始・再開時に false へ戻す。
  // state ではなく ref を使うことで、通知 effect 内での setState（再レンダー誘発）を避ける。
  const hasNotifiedRef = useRef(false);

  // 1秒ごとに残り時間を再計算する。終了したら running=false / finished=true に遷移。
  useEffect(() => {
    if (!timer?.running) {
      return;
    }
    // 新しい計測（開始・再開）に入ったので通知ガードを解除する。
    hasNotifiedRef.current = false;
    const interval = setInterval(() => {
      setTimer((current) => {
        if (!current?.running) {
          return current;
        }
        const remaining = current.endsAt
          ? Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000))
          : current.remaining;
        if (remaining <= 0) {
          return { ...current, remaining: 0, running: false, finished: true, endsAt: null };
        }
        return { ...current, remaining };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer?.running]);

  // 終了時に一度だけ振動＋サウンドで通知する。state は更新せず ref でガードする。
  useEffect(() => {
    if (!timer?.finished || hasNotifiedRef.current) {
      return;
    }
    hasNotifiedRef.current = true;
    if (settings.vibrationEnabled) {
      Vibration.vibrate([0, 280, 120, 280]);
    }
    if (settings.soundEnabled) {
      void timerPlayer
        .seekTo(0)
        .then(() => timerPlayer.play())
        .catch(() => {
          // The visible timer-complete state remains useful even if audio playback fails.
        });
    }
  }, [timer?.finished, timerPlayer, settings.soundEnabled, settings.vibrationEnabled]);

  return { timer, setTimer };
}
