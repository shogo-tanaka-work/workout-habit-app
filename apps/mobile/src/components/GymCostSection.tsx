import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { formatCount } from '../utils/number';
import type { GymCost } from '../utils/gymCost';

// 今月のジム代（1回あたり）。月額を設定していない人には出さない
// （使っていない機能を見せない。PlannedWorkoutSection と同じ扱い）。
//
// **日の記録とは別のくくり**なので、日詳細の中ではなくカレンダーの下に独立して置く
// （HomeScreen）。月の話が日の欄に混ざっていると、選んだ日の数字と読み違える。
//
// カレンダーと日詳細の間に挟まる位置なので、区画は2行に抑える。主役は「1回あたり」で、
// 回数と「あと1回」は右側へ小さく添える。次の1回の動機はこの右下の1行が担う。
export function GymCostSection({
  monthlyFeeYen,
  cost,
  monthLabel,
}: {
  monthlyFeeYen: number;
  cost: GymCost;
  /** 「8月」のような見出し用の月表記。対象月は呼び出し側が決める。 */
  monthLabel: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{monthLabel}のジム代</Text>
        <Text style={styles.faint}>月額 {formatCount(monthlyFeeYen)}円</Text>
      </View>
      <View style={styles.gymCostBody}>
        {cost.yenPerVisit === null ? (
          <Text style={styles.muted}>
            この月はまだ記録がありません。1回行くと {formatCount(monthlyFeeYen)}円/回 です。
          </Text>
        ) : (
          <>
            <View style={styles.statPrimaryValueRow}>
              <Text style={styles.statPrimaryValue}>{formatCount(cost.yenPerVisit)}</Text>
              <Text style={styles.statPrimaryUnit}>円 / 回</Text>
            </View>
            <View style={styles.gymCostNotes}>
              <Text style={styles.muted}>{formatCount(cost.visitCount)}回</Text>
              <Text style={styles.faint}>
                あと1回で {formatCount(cost.yenPerVisitAfterNextVisit)}円/回
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
