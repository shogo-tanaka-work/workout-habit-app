import { Pressable, Text, View } from 'react-native';

import { BodyLogSection } from '../components/BodyLogSection';
import { StatStrip } from '../components/StatStrip';
import { styles } from '../styles/appStyles';
import type {
  BodyLog,
  Exercise,
  Workout,
  WeeklyStats,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import type { BodyPartSummary } from '../utils/aggregate';
import { formatSetsInline } from '../utils/aggregate';
import { formatJapaneseDate } from '../utils/datetime';

export function HomeScreen({
  activeWorkout,
  completedWorkouts,
  workoutExercises,
  visibleSets,
  exerciseById,
  stats,
  bodyPartSummaries,
  bodyLogs,
  onStart,
  onResume,
  onSaveBodyLog,
}: {
  activeWorkout: Workout | null;
  completedWorkouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  stats: WeeklyStats;
  bodyPartSummaries: BodyPartSummary[];
  bodyLogs: BodyLog[];
  onStart: () => void;
  onResume: () => void;
  onSaveBodyLog: (bodyWeightKg: number, bodyFatPercentage: number | null) => void;
}) {
  const maxBodyPartVolume = bodyPartSummaries.reduce(
    (max, summary) => Math.max(max, summary.totalVolume),
    0,
  );
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

      {bodyPartSummaries.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>今週の部位別ボリューム</Text>
          </View>
          <View style={styles.sectionBody}>
            {bodyPartSummaries.map((summary) => {
              const ratio = maxBodyPartVolume > 0 ? summary.totalVolume / maxBodyPartVolume : 0;
              return (
                <View key={summary.bodyPartId} style={styles.bodyPartRow}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.panelText}>{summary.name}</Text>
                    <Text style={styles.muted}>
                      {summary.setCount} セット ・{' '}
                      {Math.round(summary.totalVolume).toLocaleString()} kg
                    </Text>
                  </View>
                  <View style={styles.bodyPartBarTrack}>
                    <View style={[styles.bodyPartBarFill, { width: `${ratio * 100}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

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

      <BodyLogSection bodyLogs={bodyLogs} onSave={onSaveBodyLog} />
    </View>
  );
}
