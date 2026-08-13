import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { StatSummary } from '../components/StatSummary';
import { TrendChart } from '../components/TrendChart';
import { styles } from '../styles/appStyles';
import { bodyPartColor, colors } from '../styles/theme';
import type {
  BodyLog,
  BodyPart,
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../types/domain';
import {
  buildVolumeSeries,
  summarizeByBodyPart,
  summarizeByExercise,
  summarizePeriod,
} from '../utils/aggregate';
import { formatMonthDay, periodStartIso, startOfWeekIsoDate } from '../utils/datetime';
import { formatCount, formatVolume, formatWeight } from '../utils/number';
import { setsOfWorkoutExercises } from '../utils/workoutTree';

// グラフ1本あたりの最大プロット数（期間内でもこれ以上は古い側を間引く）。
const TREND_POINT_LIMIT = 30;

const PERIODS = [
  { key: 'week', label: '今週', months: 0 },
  { key: '1m', label: '1ヶ月', months: 1 },
  { key: '3m', label: '3ヶ月', months: 3 },
  { key: '6m', label: '6ヶ月', months: 6 },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

// 3ヶ月以上は1点＝1日だと読めないので、週単位へまとめる。
const WEEKLY_BUCKET_FROM_MONTHS = 3;

// 履歴は「どれだけ積んで、どう伸びたか」を見る画面。期間 × 種目で集計する。
//
// 日付ごとの記録一覧はここに置かない。「いつ何をやったか」はホームのカレンダーが持ち、
// 二重に置くと同じ内容を2画面で保守することになる。記録の編集もホームから入る。
export function HistoryScreen({
  workouts,
  workoutExercises,
  visibleSets,
  exerciseById,
  bodyPartById,
  bodyLogs,
  onSelectExercise,
}: {
  /** 実施済みのワークアウト（performedAt 降順）。 */
  workouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  bodyPartById: Map<string, BodyPart>;
  /** ボディログ（measuredAt 降順）。 */
  bodyLogs: BodyLog[];
  onSelectExercise: (exerciseId: string) => void;
}) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('week');
  const period = PERIODS.find((candidate) => candidate.key === periodKey) ?? PERIODS[0];

  // 期間の起点。定義は utils/datetime.ts の periodStartIso が持つ。
  const cutoff = useMemo(() => periodStartIso(period.months) ?? '', [period.months]);

  const periodWorkouts = useMemo(
    () => workouts.filter((workout) => workout.performedAt >= cutoff),
    [workouts, cutoff],
  );

  const summary = useMemo(
    () => summarizePeriod(periodWorkouts, workoutExercises, visibleSets),
    [periodWorkouts, workoutExercises, visibleSets],
  );

  const bodyPartSummaries = useMemo(() => {
    const workoutIds = new Set(periodWorkouts.map((workout) => workout.id));
    const items = workoutExercises.filter((item) => workoutIds.has(item.workoutId));
    const sets = setsOfWorkoutExercises(items, visibleSets);
    return summarizeByBodyPart(items, sets, exerciseById, bodyPartById);
  }, [periodWorkouts, workoutExercises, visibleSets, exerciseById, bodyPartById]);

  const exerciseTotals = useMemo(
    () => summarizeByExercise(periodWorkouts, workoutExercises, visibleSets, exerciseById),
    [periodWorkouts, workoutExercises, visibleSets, exerciseById],
  );

  const volumePoints = useMemo(() => {
    const isWeekly = period.months >= WEEKLY_BUCKET_FROM_MONTHS;
    const series = buildVolumeSeries(
      periodWorkouts,
      workoutExercises,
      visibleSets,
      isWeekly ? startOfWeekIsoDate : (isoDate) => isoDate,
    );
    return series
      .slice(-TREND_POINT_LIMIT)
      .map((point) => ({ label: formatMonthDay(point.date), value: point.value }));
  }, [periodWorkouts, workoutExercises, visibleSets, period.months]);

  const bodyWeightPoints = useMemo(
    () =>
      bodyLogs
        .filter((log) => log.measuredAt >= cutoff)
        .slice(0, TREND_POINT_LIMIT)
        .reverse()
        .map((log) => ({ label: formatMonthDay(log.measuredAt), value: log.bodyWeightKg })),
    [bodyLogs, cutoff],
  );

  const maxBodyPartVolume = bodyPartSummaries.reduce(
    (max, item) => Math.max(max, item.totalVolume),
    0,
  );

  return (
    <View style={styles.stack}>
      <View style={styles.segmentRow}>
        {PERIODS.map((candidate, index) => {
          const isActive = candidate.key === periodKey;
          return (
            <Pressable
              key={candidate.key}
              style={[
                styles.segment,
                index === PERIODS.length - 1 && styles.segmentLast,
                isActive && styles.segmentActive,
              ]}
              onPress={() => setPeriodKey(candidate.key)}
            >
              <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
                {candidate.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{period.label}のトレーニング</Text>
        </View>
        <StatSummary
          primary={{ label: '総ボリューム', value: formatCount(summary.totalVolume), unit: 'kg' }}
          items={[
            { label: '記録', value: formatCount(summary.workoutCount), unit: '回' },
            { label: 'セット', value: formatCount(summary.setCount) },
            { label: 'レップ', value: formatCount(summary.totalReps) },
          ]}
        />
        {bodyPartSummaries.length > 0 ? (
          <View style={styles.sectionBody}>
            {bodyPartSummaries.map((item) => {
              const ratio = maxBodyPartVolume > 0 ? item.totalVolume / maxBodyPartVolume : 0;
              return (
                <View key={item.bodyPartId} style={styles.bodyPartRow}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.panelText}>{item.name}</Text>
                    <Text style={styles.muted}>
                      {item.setCount} セット ・ {formatVolume(item.totalVolume)}
                    </Text>
                  </View>
                  <View style={styles.bodyPartBarTrack}>
                    <View
                      style={[
                        styles.bodyPartBarFill,
                        {
                          width: `${ratio * 100}%`,
                          backgroundColor: bodyPartColor(item.bodyPartId),
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      {volumePoints.length >= 2 ? (
        <TrendChart
          title={
            period.months >= WEEKLY_BUCKET_FROM_MONTHS
              ? '総ボリューム推移（週）'
              : '総ボリューム推移'
          }
          unit="kg"
          points={volumePoints}
          color={colors.chartPrimary}
        />
      ) : null}

      {bodyWeightPoints.length >= 2 ? (
        <TrendChart
          title="体重推移"
          unit="kg"
          points={bodyWeightPoints}
          color={colors.chartSecondary}
        />
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>種目別</Text>
          <Text style={styles.faint}>{exerciseTotals.length} 種目</Text>
        </View>
        {exerciseTotals.length === 0 ? (
          <View style={styles.sectionBody}>
            <Text style={styles.muted}>
              この期間の記録はまだありません。ワークアウトを完了すると、種目ごとの積み上げが並びます。
            </Text>
          </View>
        ) : null}
        {exerciseTotals.map((item) => (
          <Pressable
            key={item.exerciseId}
            style={styles.exerciseRow}
            onPress={() => onSelectExercise(item.exerciseId)}
          >
            <View style={styles.exerciseRowHeader}>
              <View
                style={[styles.exerciseDot, { backgroundColor: bodyPartColor(item.bodyPartId) }]}
              />
              <View style={styles.flex}>
                <Text style={styles.exerciseRowName}>{item.name}</Text>
                <Text style={styles.faint}>
                  {item.sessionCount} 回 ・ {item.summary.setCount} セット
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
            <StatSummary
              primary={{
                label: 'ボリューム',
                value: formatCount(item.summary.totalVolume),
                unit: 'kg',
              }}
              items={[
                { label: '推定1RM', value: formatWeight(item.summary.bestOneRepMax) },
                { label: 'レップ', value: formatCount(item.summary.totalReps) },
                { label: '最大レップ', value: formatCount(item.summary.maxReps) },
              ]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
