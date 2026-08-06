import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';

// 値と単位を分けて持つ。単位は「回」「kg」のような計測単位のときだけ付け、
// 「セット」のようにラベルが数える対象そのものを表す場合は省く。
export type StatItem = {
  label: string;
  value: string;
  unit?: string;
};

// 区画の指標表示。主役の数値を1つだけ大きく見せ、残りは1行の従属指標として並べる。
// 「1画面で最も大きい数値は1つに絞る」（.agents/DESIGN.md）ための共通部品。
export function StatSummary({ primary, items }: { primary: StatItem; items: StatItem[] }) {
  return (
    <View style={styles.statSummary}>
      <View style={styles.statPrimaryValueRow}>
        <Text style={styles.statPrimaryValue}>{primary.value}</Text>
        {primary.unit ? <Text style={styles.statPrimaryUnit}>{primary.unit}</Text> : null}
      </View>
      <Text style={styles.statPrimaryLabel}>{primary.label}</Text>
      {items.length > 0 ? (
        <View style={styles.statItemRow}>
          {items.map((item, index) => (
            <View key={item.label} style={styles.statItem}>
              {index > 0 ? <Text style={styles.statSeparator}>・</Text> : null}
              <Text style={styles.statItemLabel}>{item.label}</Text>
              <Text style={styles.statItemValue}>
                {item.value}
                {item.unit ?? ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
