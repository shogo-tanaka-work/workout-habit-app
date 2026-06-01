import type { Dispatch, SetStateAction } from 'react';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { TimerState } from '../types/domain';
import { formatTimer } from '../utils/format';

export function TimerBanner({
  timer,
  setTimer,
}: {
  timer: TimerState;
  setTimer: Dispatch<SetStateAction<TimerState | null>>;
}) {
  const toggleRunning = () => {
    setTimer((current) => {
      if (!current || current.finished) {
        return current;
      }
      if (current.running) {
        return { ...current, running: false, endsAt: null };
      }
      return { ...current, running: true, endsAt: Date.now() + current.remaining * 1000 };
    });
  };

  return (
    <View style={[styles.timerBanner, timer.finished && styles.timerFinished]}>
      <View>
        <Text style={styles.timerLabel}>{timer.finished ? '休憩終了' : '休憩タイマー'}</Text>
        <Text style={styles.timerTitle}>{timer.exerciseName}</Text>
      </View>
      <Text style={styles.timerTime}>{formatTimer(timer.remaining)}</Text>
      <View style={styles.timerActions}>
        <Pressable style={styles.iconButton} onPress={toggleRunning}>
          <Text style={styles.iconButtonText}>{timer.running ? '一時停止' : '再開'}</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => setTimer(null)}>
          <Text style={styles.iconButtonText}>閉じる</Text>
        </Pressable>
      </View>
    </View>
  );
}
