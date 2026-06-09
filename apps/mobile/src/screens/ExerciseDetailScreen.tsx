import { Text, View } from 'react-native';

import { SetTable } from '../components/SetTable';
import { StatStrip } from '../components/StatStrip';
import { TrendChart } from '../components/TrendChart';
import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { Exercise } from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';
import { formatJapaneseDate, formatMonthDay } from '../utils/datetime';

const RECENT_SESSION_COUNT = 5;
const TREND_SESSION_COUNT = 12;

// 参考UI（種目クリック詳細）準拠の種目詳細。
// 日付ごとのセット表＋集計ストリップを新しい順に並べ、下に推移グラフを置く。
export function ExerciseDetailScreen({
  exercise,
  sessions,
}: {
  exercise: Exercise;
  sessions: ExerciseSession[];
}) {
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

  // グラフは古い→新しい順で描く。
  const trendSessions = sessions.slice(0, TREND_SESSION_COUNT).reverse();
  const volumePoints = trendSessions.map((session) => ({
    label: formatMonthDay(session.workout.performedAt),
    value: session.summary.totalVolume,
  }));
  const oneRepMaxPoints = trendSessions.map((session) => ({
    label: formatMonthDay(session.workout.performedAt),
    value: session.summary.bestOneRepMax,
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
      <TrendChart
        title="ボリューム推移"
        unit="kg"
        points={volumePoints}
        color={colors.chartPrimary}
      />
      <TrendChart
        title="推定1RM推移"
        unit="kg"
        points={oneRepMaxPoints}
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
