import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';

export type StatItem = {
  label: string;
  value: string;
};

// 参考UI準拠の統計ストリップ。縦罫線で区切ったセルに「ラベル（上）＋値（下）」を並べる。
export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <View style={styles.statStrip}>
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[styles.statCell, index === items.length - 1 && styles.statCellLast]}
        >
          <Text style={styles.statLabel}>{item.label}</Text>
          <Text style={styles.statValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}
