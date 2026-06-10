import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SetTable } from '../components/SetTable';
import { StatStrip } from '../components/StatStrip';
import { TrendChart } from '../components/TrendChart';
import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { Exercise } from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';
import { formatJapaneseDate, formatMonthDay, isoDateMonthsAgo } from '../utils/datetime';

const RECENT_SESSION_COUNT = 5;
// グラフ1本あたりの最大プロット数（期間内でもこれ以上は古い側を間引く）。
const TREND_POINT_LIMIT = 30;

const PERIODS = [
  { key: '1m', label: '1ヶ月', months: 1 },
  { key: '3m', label: '3ヶ月', months: 3 },
  { key: '6m', label: '6ヶ月', months: 6 },
  { key: '1y', label: '1年', months: 12 },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

// 参考UI（種目クリック詳細・種目単位詳細）準拠の種目詳細。
// 日付ごとのセット表＋集計を新しい順に並べ、下に期間切り替え付きの推移グラフ群を置く。
export function ExerciseDetailScreen({
  exercise,
  sessions,
}: {
  exercise: Exercise;
  sessions: ExerciseSession[];
}) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('3m');

  if (sessions.length === 0) {
    return (
      <View style={styles.stack}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{exercise.name}</Text>
          </View>
          <View style={styles.sectionBody}>
            <Text style={styles.muted}>この種目の記録はまだありません。</Text>
          </View>
        </View>
      </View>
    );
  }

  const [latestSession, ...pastSessions] = sessions;
  const recentPastSessions = pastSessions.slice(0, RECENT_SESSION_COUNT);

  const period = PERIODS.find((candidate) => candidate.key === periodKey) ?? PERIODS[1];
  const cutoff = isoDateMonthsAgo(period.months, new Date());
  const periodSessions = sessions.filter((session) => session.workout.performedAt >= cutoff);

  // 期間全体のサマリ（参考UIの「総ボリューム・総セット・トレーニング回数」）。
  let periodVolume = 0;
  let periodSetCount = 0;
  for (const session of periodSessions) {
    periodVolume += session.summary.totalVolume;
    periodSetCount += session.summary.setCount;
  }

  // グラフは古い→新しい順で描く。
  const trendSessions = periodSessions.slice(0, TREND_POINT_LIMIT).reverse();
  const buildPoints = (selectValue: (session: ExerciseSession) => number) =>
    trendSessions.map((session) => ({
      label: formatMonthDay(session.workout.performedAt),
      value: selectValue(session),
    }));

  return (
    <View style={styles.stack}>
      <SessionSection
        title={formatJapaneseDate(latestSession.workout.performedAt)}
        session={latestSession}
      />

      {recentPastSessions.length > 0 ? (
        <View style={styles.stack}>
          <Text style={styles.muted}>過去{recentPastSessions.length}回分の記録</Text>
          {recentPastSessions.map((session) => (
            <SessionSection
              key={session.workout.id}
              title={formatJapaneseDate(session.workout.performedAt)}
              session={session}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.muted}>推移</Text>
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
        <StatStrip
          items={[
            { label: '総ボリューム', value: `${Math.round(periodVolume).toLocaleString()} kg` },
            { label: '総セット', value: `${periodSetCount} セット` },
            { label: 'トレーニング回数', value: `${periodSessions.length} 回` },
          ]}
        />
      </View>

      <TrendChart
        title="ボリューム推移"
        unit="kg"
        points={buildPoints((session) => session.summary.totalVolume)}
        color={colors.chartPrimary}
      />
      <TrendChart
        title="推定1RM推移"
        unit="kg"
        points={buildPoints((session) => session.summary.bestOneRepMax)}
        color={colors.chartPrimary}
      />
      <TrendChart
        title="総レップ数推移"
        unit="回"
        points={buildPoints((session) => session.summary.totalReps)}
        color={colors.chartSecondary}
      />
      <TrendChart
        title="最大レップ数推移"
        unit="回"
        points={buildPoints((session) => session.summary.maxReps)}
        color={colors.chartSecondary}
      />
    </View>
  );
}

function SessionSection({ title, session }: { title: string; session: ExerciseSession }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>
        <SetTable sets={session.sets} />
      </View>
      <StatStrip
        items={[
          {
            label: 'ボリューム',
            value: `${Math.round(session.summary.totalVolume).toLocaleString()} kg`,
          },
          { label: '推定1RM', value: `${session.summary.bestOneRepMax} kg` },
          { label: '総レップ数', value: `${session.summary.totalReps} 回` },
          { label: '最大レップ数', value: `${session.summary.maxReps} 回` },
        ]}
      />
    </View>
  );
}
