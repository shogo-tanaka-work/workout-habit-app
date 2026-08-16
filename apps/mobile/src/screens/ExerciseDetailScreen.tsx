import { useMemo, useState } from 'react';
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
import { rmDivisorFor, rmFormulaNote, showsOneRepMax } from '../utils/oneRepMax';

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

// セッション列（古い→新しい順）から TrendChart へ渡す点列を作る。
const buildTrendPoints = (
  trendSessions: ExerciseSession[],
  selectValue: (session: ExerciseSession) => number,
) =>
  trendSessions.map((session) => ({
    label: formatMonthDay(session.workout.performedAt),
    value: selectValue(session),
  }));

// 参考UI（種目クリック詳細・種目単位詳細）準拠の種目詳細。
// 日付ごとのセット表＋集計を新しい順に並べ、下に期間切り替え付きの推移グラフ群を置く。
export function ExerciseDetailScreen({
  exercise,
  sessions,
}: {
  exercise: Exercise;
  sessions: ExerciseSession[];
}) {
  // 推定1RM と RM 計算機は BIG3 だけに出す（utils/oneRepMax.ts の showsOneRepMax）。
  const withOneRepMax = showsOneRepMax(exercise.id);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('3m');
  const period = PERIODS.find((candidate) => candidate.key === periodKey) ?? PERIODS[1];

  // 期間の絞り込みと点列の組み立て。memo した TrendChart が効くよう、
  // sessions か期間が変わったときだけ新しい配列を作る。
  const periodSessions = useMemo(() => {
    const cutoff = isoDateMonthsAgo(period.months, new Date());
    return sessions.filter((session) => session.workout.performedAt >= cutoff);
  }, [sessions, period.months]);

  // グラフは古い→新しい順で描く。
  const trendSessions = useMemo(
    () => periodSessions.slice(0, TREND_POINT_LIMIT).reverse(),
    [periodSessions],
  );

  const volumePoints = useMemo(
    () => buildTrendPoints(trendSessions, (session) => session.summary.totalVolume),
    [trendSessions],
  );
  const oneRepMaxPoints = useMemo(
    () => buildTrendPoints(trendSessions, (session) => session.summary.bestOneRepMax),
    [trendSessions],
  );
  const totalRepsPoints = useMemo(
    () => buildTrendPoints(trendSessions, (session) => session.summary.totalReps),
    [trendSessions],
  );
  const maxRepsPoints = useMemo(
    () => buildTrendPoints(trendSessions, (session) => session.summary.maxReps),
    [trendSessions],
  );

  if (sessions.length === 0) {
    return (
      <View style={styles.stack}>
        {/* 画面のヘッダーが種目名を出しているので、ここで名前を繰り返さない。 */}
        <View style={styles.section}>
          <View style={styles.sectionBody}>
            <Text style={styles.sectionTitle}>まだ記録がありません</Text>
            <Text style={styles.muted}>
              この画面では、実施ごとのセット内容と、ボリューム・レップ数の推移を振り返れます。
              記録画面でこの種目を追加してセットを入れると、ここに並びます。
            </Text>
          </View>
        </View>
        {withOneRepMax ? (
          <RmCalculator
            initialWeightKg={exercise.defaultBarWeightKg}
            initialReps={8}
            exerciseId={exercise.id}
          />
        ) : null}
      </View>
    );
  }

  const [latestSession, ...pastSessions] = sessions;
  const recentPastSessions = pastSessions.slice(0, RECENT_SESSION_COUNT);

  // RM計算機の初期値に使う、直近セッションのベストセット（推定1RM最大）。
  const rmDivisor = rmDivisorFor(exercise.id);
  const bestRecentSet = latestSession.sets.reduce((best, set) =>
    estimateOneRepMax(set.weightKg, set.reps, rmDivisor) >
    estimateOneRepMax(best.weightKg, best.reps, rmDivisor)
      ? set
      : best,
  );

  // 期間全体のサマリ（参考UIの「総ボリューム・総セット・トレーニング回数」）。
  let periodVolume = 0;
  let periodSetCount = 0;
  for (const session of periodSessions) {
    periodVolume += session.summary.totalVolume;
    periodSetCount += session.summary.setCount;
  }

  return (
    <View style={styles.stack}>
      <SessionSection
        title={formatJapaneseDate(latestSession.workout.performedAt)}
        session={latestSession}
        withOneRepMax={withOneRepMax}
      />

      {recentPastSessions.length > 0 ? (
        <View style={styles.stack}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>過去の記録</Text>
            <Text style={styles.faint}>直近 {recentPastSessions.length} 回</Text>
          </View>
          {recentPastSessions.map((session) => (
            <SessionSection
              key={session.workout.id}
              title={formatJapaneseDate(session.workout.performedAt)}
              session={session}
              withOneRepMax={withOneRepMax}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>推移</Text>
      </View>
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
        points={volumePoints}
        color={colors.chartPrimary}
      />
      {withOneRepMax ? (
        <TrendChart
          title="推定1RM推移"
          unit="kg"
          points={oneRepMaxPoints}
          color={colors.chartPrimary}
        />
      ) : null}
      <TrendChart
        title="総レップ数推移"
        unit="回"
        points={totalRepsPoints}
        color={colors.chartSecondary}
      />
      <TrendChart
        title="最大レップ数推移"
        unit="回"
        points={maxRepsPoints}
        color={colors.chartSecondary}
      />

      {withOneRepMax ? (
        <RmCalculator
          initialWeightKg={bestRecentSet.weightKg}
          initialReps={bestRecentSet.reps}
          exerciseId={exercise.id}
        />
      ) : null}
    </View>
  );
}

const RM_TABLE_REPS = [1, 2, 3, 5, 8, 10] as const;

// RM 計算機。重量と回数から推定1RMと、レップ数別の目安重量を出す。
// 換算式は種目で変わる（BIG3 は FWJ の換算表、それ以外は Epley 式）。
function RmCalculator({
  initialWeightKg,
  initialReps,
  exerciseId,
}: {
  initialWeightKg: number;
  initialReps: number;
  exerciseId: string;
}) {
  const [weightKg, setWeightKg] = useState(initialWeightKg);
  const [reps, setReps] = useState(initialReps);
  const divisor = rmDivisorFor(exerciseId);
  const oneRepMax = estimateOneRepMax(weightKg, reps, divisor);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>RM計算機</Text>
        <Text style={styles.accentNote}>推定1RM {oneRepMax} kg</Text>
      </View>
      <View style={styles.sectionBody}>
        <View style={styles.inputGrid}>
          <View style={styles.inputGridItem}>
            <LabeledNumber label="重量" value={weightKg} suffix="kg" onChange={setWeightKg} />
          </View>
          <View style={styles.inputGridItem}>
            <LabeledNumber
              label="回数"
              value={reps}
              suffix="回"
              onChange={(value) => setReps(Math.max(0, Math.round(value)))}
            />
          </View>
        </View>
        <View style={styles.setTable}>
          <View style={styles.setTableRow}>
            <View style={styles.setTableLabelCell}>
              <Text style={styles.setTableLabelText}>レップ数</Text>
            </View>
            {RM_TABLE_REPS.map((tableReps) => (
              <View key={`reps-${tableReps}`} style={styles.rmTableCell}>
                <Text style={styles.setTableCellText}>{tableReps}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.setTableRow, styles.setTableRowLast]}>
            <View style={styles.setTableLabelCell}>
              <Text style={styles.setTableLabelText}>目安重量</Text>
            </View>
            {RM_TABLE_REPS.map((tableReps) => (
              <View key={`weight-${tableReps}`} style={styles.rmTableCell}>
                <Text style={styles.setTableCellText}>
                  {weightForReps(oneRepMax, tableReps, divisor)}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={styles.faint}>{rmFormulaNote(exerciseId)}</Text>
      </View>
    </View>
  );
}

function SessionSection({
  title,
  session,
  withOneRepMax,
}: {
  title: string;
  session: ExerciseSession;
  /** 推定1RM を出すか（BIG3 だけ）。 */
  withOneRepMax: boolean;
}) {
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
          ...(withOneRepMax
            ? [{ label: '推定1RM', value: formatWeight(session.summary.bestOneRepMax) }]
            : []),
          { label: 'レップ', value: formatCount(session.summary.totalReps) },
          { label: '最大レップ', value: formatCount(session.summary.maxReps) },
        ]}
      />
    </View>
  );
}
