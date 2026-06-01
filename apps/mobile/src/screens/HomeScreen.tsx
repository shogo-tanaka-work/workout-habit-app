import { Pressable, Text, View } from 'react-native';

import { Metric } from '../components/Metric';
import { styles } from '../styles/appStyles';
import type { Workout, WorkoutStats } from '../types/domain';

export function HomeScreen({
  activeWorkout,
  completedWorkouts,
  stats,
  onStart,
  onResume,
}: {
  activeWorkout: Workout | null;
  completedWorkouts: Workout[];
  stats: WorkoutStats;
  onStart: () => void;
  onResume: () => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>今日の記録を始める</Text>
        <Text style={styles.heroText}>
          セットを追加した瞬間から保存します。閉じても、あとで続きから再開できます。
        </Text>
        <Pressable style={styles.primaryButton} onPress={activeWorkout ? onResume : onStart}>
          <Text style={styles.primaryButtonText}>
            {activeWorkout ? '途中の記録を再開' : 'ワークアウト開始'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <Metric label="保存済みセット" value={`${stats.completedSetCount}`} />
        <Metric
          label="総ボリューム"
          value={`${Math.round(stats.totalVolume).toLocaleString()}kg`}
        />
        <Metric label="総レップ" value={`${stats.totalReps}`} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>前回の記録</Text>
        {completedWorkouts[0] ? (
          <Text style={styles.panelText}>
            {completedWorkouts[0].performedAt} のワークアウトを保存済み
          </Text>
        ) : (
          <Text style={styles.muted}>まだ完了したワークアウトはありません。</Text>
        )}
      </View>
    </View>
  );
}
