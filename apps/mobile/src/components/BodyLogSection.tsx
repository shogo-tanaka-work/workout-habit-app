import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { BodyLog } from '../types/domain';
import { formatJapaneseDate, formatMonthDay } from '../utils/datetime';
import { LabeledNumber } from './LabeledNumber';
import { TrendChart } from './TrendChart';

const TREND_POINT_LIMIT = 30;
const BODY_WEIGHT_STEP_KG = 0.5;
const BODY_FAT_STEP_PERCENT = 0.5;

// ボディログ（体重・体脂肪率）の入力と推移表示。ホームに置く。
// bodyLogs は measuredAt 降順（最新が先頭）で渡す。
export function BodyLogSection({
  bodyLogs,
  onSave,
}: {
  bodyLogs: BodyLog[];
  onSave: (bodyWeightKg: number, bodyFatPercentage: number | null) => void;
}) {
  const latestLog = bodyLogs[0] ?? null;
  const [bodyWeightKg, setBodyWeightKg] = useState(latestLog?.bodyWeightKg ?? 0);
  const [bodyFatPercentage, setBodyFatPercentage] = useState(latestLog?.bodyFatPercentage ?? 0);

  const trendPoints = bodyLogs
    .slice(0, TREND_POINT_LIMIT)
    .reverse()
    .map((log) => ({ label: formatMonthDay(log.measuredAt), value: log.bodyWeightKg }));

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>ボディログ</Text>
          {latestLog ? (
            <Text style={styles.faint}>
              {formatJapaneseDate(latestLog.measuredAt)} ・ {latestLog.bodyWeightKg} kg
              {latestLog.bodyFatPercentage !== null ? ` ・ ${latestLog.bodyFatPercentage}%` : ''}
            </Text>
          ) : null}
        </View>
        <View style={styles.sectionBody}>
          <View style={styles.inputGrid}>
            <LabeledNumber
              label="体重"
              value={bodyWeightKg}
              suffix="kg"
              step={BODY_WEIGHT_STEP_KG}
              onChange={setBodyWeightKg}
            />
            <LabeledNumber
              label="体脂肪率"
              value={bodyFatPercentage}
              suffix="%"
              step={BODY_FAT_STEP_PERCENT}
              onChange={setBodyFatPercentage}
            />
          </View>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => onSave(bodyWeightKg, bodyFatPercentage > 0 ? bodyFatPercentage : null)}
          >
            <Text style={styles.secondaryButtonText}>今日の値を保存</Text>
          </Pressable>
        </View>
      </View>
      {trendPoints.length >= 2 ? (
        <TrendChart
          title="体重推移"
          unit="kg"
          points={trendPoints}
          color={colors.chartSecondary}
        />
      ) : null}
    </View>
  );
}
