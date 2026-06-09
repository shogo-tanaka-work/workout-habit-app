import { ScrollView, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { WorkoutSet } from '../types/domain';

type TableLine = {
  label: string;
  values: { text: string; isWarmup: boolean }[];
};

// 参考UI準拠のセット表。左端にラベル列（セット / 重量 / レップ数）、
// 右へセットごとの列を並べる。セット数が多い場合は横スクロールで逃がす。
export function SetTable({ sets }: { sets: WorkoutSet[] }) {
  const lines: TableLine[] = [
    {
      label: 'セット',
      values: sets.map((set, index) => ({
        text: set.isWarmup ? 'W' : `${index + 1}`,
        isWarmup: set.isWarmup,
      })),
    },
    {
      label: '重量',
      values: sets.map((set) => ({ text: `${set.weightKg}`, isWarmup: set.isWarmup })),
    },
    {
      label: 'レップ数',
      values: sets.map((set) => ({ text: `${set.reps}`, isWarmup: set.isWarmup })),
    },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.setTable}>
        {lines.map((line, lineIndex) => (
          <View
            key={line.label}
            style={[styles.setTableRow, lineIndex === lines.length - 1 && styles.setTableRowLast]}
          >
            <View style={styles.setTableLabelCell}>
              <Text style={styles.setTableLabelText}>{line.label}</Text>
            </View>
            {line.values.map((value, valueIndex) => (
              <View key={`${line.label}-${valueIndex}`} style={styles.setTableCell}>
                <Text
                  style={[styles.setTableCellText, value.isWarmup && styles.setTableWarmupText]}
                >
                  {value.text}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
