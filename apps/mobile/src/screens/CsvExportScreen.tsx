import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { formatDate, isoDateMonthsAgo, startOfWeekIso } from '../utils/datetime';

type CsvTarget = 'workouts' | 'bodyLogs';

export type CsvExportRequest = {
  targets: CsvTarget[];
  /** この日以降を出力する。全期間なら null。 */
  since: string | null;
};

const TARGETS: { key: CsvTarget; label: string; description: string }[] = [
  { key: 'workouts', label: 'トレーニング記録', description: '日付・種目・セット・重量・回数' },
  { key: 'bodyLogs', label: 'ボディログ', description: '日付・体重・体脂肪率' },
];

// 期間は「いつから」だけを決める。終わりは常に今日で、未来の記録は無い。
const PERIODS = [
  { key: 'all', label: '全期間', months: null },
  { key: 'week', label: '今週', months: 0 },
  { key: '1m', label: '1ヶ月', months: 1 },
  { key: '3m', label: '3ヶ月', months: 3 },
  { key: '6m', label: '6ヶ月', months: 6 },
  { key: '1y', label: '1年', months: 12 },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

const sinceOf = (months: number | null): string | null => {
  if (months === null) {
    return null;
  }
  return months === 0 ? startOfWeekIso(new Date()) : isoDateMonthsAgo(months, new Date());
};

// CSV出力の条件を決めてから書き出す。
//
// 以前は設定メニューのタップで全期間・全データを即共有していた。
// 記録が増えるほど中身が重くなり、必要な部分だけ取り出せなかった。
export function CsvExportScreen({ onExport }: { onExport: (request: CsvExportRequest) => void }) {
  const [targets, setTargets] = useState<CsvTarget[]>(['workouts']);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('all');

  const period = PERIODS.find((candidate) => candidate.key === periodKey) ?? PERIODS[0];
  const since = sinceOf(period.months);

  const toggleTarget = (key: CsvTarget) => {
    setTargets((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>出力するデータ</Text>
        </View>
        {TARGETS.map((target) => {
          const isSelected = targets.includes(target.key);
          return (
            <Pressable
              key={target.key}
              style={styles.exerciseRow}
              onPress={() => toggleTarget(target.key)}
            >
              <View style={styles.exercisePickerRow}>
                <View style={styles.flex}>
                  <Text style={styles.exercisePickerName}>{target.label}</Text>
                  <Text style={styles.faint}>{target.description}</Text>
                </View>
                <View style={[styles.checkBox, isSelected && styles.checkBoxChecked]}>
                  <Text style={styles.checkBoxMark}>{isSelected ? '✓' : ''}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>期間</Text>
        </View>
        <View style={styles.sectionBody}>
          <View style={styles.chipWrap}>
            {PERIODS.map((candidate) => {
              const isActive = candidate.key === periodKey;
              return (
                <Pressable
                  key={candidate.key}
                  style={[styles.choiceChip, isActive && styles.activePill]}
                  onPress={() => setPeriodKey(candidate.key)}
                >
                  <Text style={[styles.choiceChipText, isActive && styles.activePillText]}>
                    {candidate.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.faint}>
            {since === null
              ? '最初の記録から今日までを出力します。'
              : `${since} 〜 ${formatDate(new Date())} を出力します。`}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionBody}>
          <Pressable
            style={[styles.primaryButton, targets.length === 0 && styles.disabledPill]}
            disabled={targets.length === 0}
            onPress={() => onExport({ targets, since })}
          >
            <Text style={styles.primaryButtonText}>CSV出力</Text>
          </Pressable>
          {targets.length === 0 ? (
            <Text style={styles.muted}>出力するデータを1つ以上選んでください。</Text>
          ) : (
            <Text style={styles.faint}>共有シートからファイル・メールなどへ渡せます。</Text>
          )}
        </View>
      </View>
    </View>
  );
}
