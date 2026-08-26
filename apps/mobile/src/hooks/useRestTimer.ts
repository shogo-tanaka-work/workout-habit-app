import { useAudioPlayer } from 'expo-audio';
import type * as SQLite from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';

import timerCompleteSound from '../../assets/timer-complete.wav';
import { loadRestTimer, saveRestTimer } from '../db/appSettings';
import { cancelRestFinished, scheduleRestFinished } from '../notifications/restTimer';
import type { TimerSettings, TimerState } from '../types/domain';

// 休憩タイマーの状態とカウントダウン・完了通知（振動＋音）を管理するフック。
// 音・振動の有効/無効は settings（種目タブのタイマー設定）に従う。
// タイマーの「開始」に伴う DB 書き込みは useWorkoutData 側（beginRestTimer）が担う。
//
// 状態は app_settings へ保存する。**アプリが落ちても休憩時間を失わない**ため。
// 保存するのは終了時刻を含む状態そのもので、復元時に経過を差し引いて残りを出す。
//
// 走っている間は OS へローカル通知を予約する。setInterval も expo-audio も
// 前面にいる間しか動かず、画面を消すと何も起きないため（src/notifications/restTimer.ts）。

/**
 * 終了表示を残す時間（ミリ秒）。鳴ったことに気づける長さだけ出して、あとは自動で閉じる。
 *
 * 休憩が終われば次のセットへ移るだけで、バナーに用は無い。手で閉じさせると、
 * 記録に戻る前にもう一操作要る。
 */
const FINISHED_BANNER_MS = 3000;

/** 保存された状態から現在の残り時間を割り出す。終了済みなら finished にする。 */
const restoreFromSaved = (saved: TimerState): TimerState => {
  if (!saved.running || saved.endsAt === null) {
    return saved;
  }
  const remaining = Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000));
  if (remaining <= 0) {
    // 不在中に終わっていた。通知は OS が出しているので、ここでは鳴らさない。
    return { ...saved, remaining: 0, running: false, finished: true, endsAt: null };
  }
  return { ...saved, remaining };
};

export function useRestTimer(settings: TimerSettings, database: SQLite.SQLiteDatabase | null) {
  const timerPlayer = useAudioPlayer(timerCompleteSound);
  const [timer, setTimerState] = useState<TimerState | null>(null);
  // 現在の計測ですでに完了通知を鳴らしたか。新しい計測の開始・再開時に false へ戻す。
  // state ではなく ref を使うことで、通知 effect 内での setState（再レンダー誘発）を避ける。
  const hasNotifiedRef = useRef(false);
  // 復元が済むまでは保存しない（初期値 null で保存済みの状態を消してしまうため）。
  const hasRestoredRef = useRef(false);

  // 状態の更新口をひとつに絞り、保存と通知予約をここへ集約する。
  const setTimer = useCallback<React.Dispatch<React.SetStateAction<TimerState | null>>>(
    (update) => {
      setTimerState((current) => {
        const next = typeof update === 'function' ? update(current) : update;
        if (!database || !hasRestoredRef.current) {
          return next;
        }
        void saveRestTimer(database, next).catch((error: unknown) => {
          console.warn(
            '[timer] 休憩タイマーの保存に失敗',
            error instanceof Error ? error.message : String(error),
          );
        });
        // 走っている間だけ通知を予約する。止めた・閉じた・終わったなら取り消す。
        if (next?.running && next.endsAt !== null) {
          void scheduleRestFinished(next.exerciseName, (next.endsAt - Date.now()) / 1000);
        } else {
          void cancelRestFinished();
        }
        return next;
      });
    },
    [database],
  );

  // 起動時に保存された状態を復元する。
  useEffect(() => {
    if (!database || hasRestoredRef.current) {
      return;
    }
    let isStale = false;
    void loadRestTimer(database)
      .then((saved) => {
        if (isStale) {
          return;
        }
        if (saved) {
          const restored = restoreFromSaved(saved);
          // 復元した終了は通知済み扱いにする（不在中に OS が鳴らしている）。
          hasNotifiedRef.current = restored.finished;
          setTimerState(restored);
        }
        hasRestoredRef.current = true;
      })
      .catch((error: unknown) => {
        console.warn(
          '[timer] 休憩タイマーの復元に失敗',
          error instanceof Error ? error.message : String(error),
        );
        hasRestoredRef.current = true;
      });
    return () => {
      isStale = true;
    };
  }, [database]);

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
  }, [timer?.running, setTimer]);

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

  // 終了したバナーは少し置いてから自分で閉じる。
  // 復元した終了（不在中に終わっていた場合）もここで片付く。
  useEffect(() => {
    if (!timer?.finished) {
      return;
    }
    const timeout = setTimeout(() => setTimer(null), FINISHED_BANNER_MS);
    return () => clearTimeout(timeout);
  }, [timer?.finished, setTimer]);

  return { timer, setTimer };
}
