import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LabeledNumber } from '../components/LabeledNumber';
import { SetTable } from '../components/SetTable';
import { StatSummary } from '../components/StatSummary';
import { TrendChart } from '../components/TrendChart';
import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { Exercise } from '../types/domain';
import type { ExerciseSession } from '../utils/aggregate';
import { formatJapaneseDate, formatMonthDay, isoDateMonthsAgo } from '../utils/datetime';
import { estimateOneRepMax, formatCount, formatWeight, weightForReps } from '../utils/number';

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
            <Text style={styles.muted}>
              この種目の記録はまだありません。ワークアウトで種目に追加すると、推移が見られます。
            </Text>
          </View>
        </View>
        <RmCalculator initialWeightKg={exercise.defaultBarWeightKg} initialReps={8} />
      </View>
    );
  }

  const [latestSession, ...pastSessions] = sessions;
  const recentPastSessions = pastSessions.slice(0, RECENT_SESSION_COUNT);

  // RM計算機の初期値に使う、直近セッションのベストセット（推定1RM最大）。
  const bestRecentSet = latestSession.sets.reduce((best, set) =>
    estimateOneRepMax(set.weightKg, set.reps) > estimateOneRepMax(best.weightKg, best.reps)
      ? set
      : best,
  );

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
        <StatSummary
          primary={{ label: '総ボリューム', value: formatCount(periodVolume), unit: 'kg' }}
          items={[
            { label: 'セット', value: formatCount(periodSetCount) },
            { label: '実施', value: formatCount(periodSessions.length), unit: '回' },
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

      <RmCalculator initialWeightKg={bestRecentSet.weightKg} initialReps={bestRecentSet.reps} />
    </View>
  );
}

const RM_TABLE_REPS = [1, 2, 3, 5, 8, 10] as const;

// Epley 式ベースの RM 計算機。重量と回数から推定1RMと、レップ数別の目安重量を出す。
function RmCalculator({
  initialWeightKg,
  initialReps,
}: {
  initialWeightKg: number;
  initialReps: number;
}) {
  const [weightKg, setWeightKg] = useState(initialWeightKg);
  const [reps, setReps] = useState(initialReps);
  const oneRepMax = estimateOneRepMax(weightKg, reps);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>RM計算機</Text>
        <Text style={styles.accentNote}>推定1RM {oneRepMax} kg</Text>
      </View>
      <View style={styles.sectionBody}>
        <View style={styles.inputGrid}>
          <LabeledNumber label="重量" value={weightKg} suffix="kg" onChange={setWeightKg} />
          <LabeledNumber
            label="回数"
            value={reps}
            suffix="回"
            onChange={(value) => setReps(Math.max(0, Math.round(value)))}
          />
        </View>
        <View style={styles.setTable}>
          <View style={styles.setTableRow}>
            <View style={styles.setTableLabelCell}>
              <Text style={styles.setTableLabelText}>レップ数</Text>
            </View>
            {RM_TABLE_REPS.map((tableReps) => (
              <View key={`reps-${tableReps}`} style={styles.setTableCell}>
                <Text style={styles.setTableCellText}>{tableReps}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.setTableRow, styles.setTableRowLast]}>
            <View style={styles.setTableLabelCell}>
              <Text style={styles.setTableLabelText}>目安重量</Text>
            </View>
            {RM_TABLE_REPS.map((tableReps) => (
              <View key={`weight-${tableReps}`} style={styles.setTableCell}>
                <Text style={styles.setTableCellText}>{weightForReps(oneRepMax, tableReps)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.faint}>Epley式（1RM = 重量 × (1 + 回数 ÷ 30)）による推定値です。</Text>
      </View>
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
      <StatSummary
        primary={{
          label: 'ボリューム',
          value: formatCount(session.summary.totalVolume),
          unit: 'kg',
        }}
        items={[
          { label: '推定1RM', value: formatWeight(session.summary.bestOneRepMax) },
          { label: 'レップ', value: formatCount(session.summary.totalReps) },
          { label: '最大レップ', value: formatCount(session.summary.maxReps) },
        ]}
      />
    </View>
  );
}
