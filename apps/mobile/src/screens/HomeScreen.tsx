import { Pressable, Text, View } from 'react-native';

import { StatStrip } from '../components/StatStrip';
import { styles } from '../styles/appStyles';
import type { Exercise, Workout, WeeklyStats, WorkoutExercise, WorkoutSet } from '../types/domain';
import { formatSetsInline } from '../utils/aggregate';
import { formatJapaneseDate } from '../utils/datetime';

export function HomeScreen({
  activeWorkout,
  completedWorkouts,
  workoutExercises,
  visibleSets,
  exerciseById,
  stats,
  onStart,
  onResume,
}: {
  activeWorkout: Workout | null;
  completedWorkouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  stats: WeeklyStats;
  onStart: () => void;
  onResume: () => void;
}) {
  const lastWorkout = completedWorkouts[0] ?? null;
  const lastWorkoutItems = lastWorkout
    ? workoutExercises
        .filter((item) => item.workoutId === lastWorkout.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionBody}>
          <Text style={styles.title}>今日の記録を始める</Text>
          {activeWorkout ? (
            <Text style={styles.accentNote}>記録途中のワークアウトがあります。</Text>
          ) : (
            <Text style={styles.muted}>
              セットを追加した瞬間から保存します。閉じても、あとで続きから再開できます。
            </Text>
          )}
          <Pressable style={styles.primaryButton} onPress={activeWorkout ? onResume : onStart}>
            <Text style={styles.primaryButtonText}>
              {activeWorkout ? '途中の記録を再開' : 'ワークアウト開始'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>今週のトレーニング</Text>
        </View>
        <StatStrip
          items={[
            { label: '記録回数', value: `${stats.workoutCount} 回` },
            { label: 'セット数', value: `${stats.setCount} セット` },
            {
              label: 'ボリューム',
              value: `${Math.round(stats.totalVolume).toLocaleString()} kg`,
            },
            { label: '総レップ数', value: `${stats.totalReps} 回` },
          ]}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>
            前回の記録
            {lastWorkout ? ` ・ ${formatJapaneseDate(lastWorkout.performedAt)}` : ''}
          </Text>
        </View>
        {lastWorkout ? (
          lastWorkoutItems.map((item) => {
            const exercise = exerciseById.get(item.exerciseId);
            const itemSets = visibleSets
              .filter((set) => set.workoutExerciseId === item.id)
              .sort((a, b) => a.orderIndex - b.orderIndex);
            return (
              <View key={item.id} style={styles.exerciseRow}>
                <View style={styles.exerciseRowHeader}>
                  <View style={styles.exerciseDot} />
                  <Text style={styles.exerciseRowName}>{exercise?.name ?? '種目'}</Text>
                  <Text style={styles.faint}>{itemSets.length} セット</Text>
                </View>
                <View style={styles.sectionBody}>
                  <Text style={styles.muted}>{formatSetsInline(itemSets)}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.sectionBody}>
            <Text style={styles.muted}>まだ完了したワークアウトはありません。</Text>
          </View>
        )}
      </View>
    </View>
  );
}
