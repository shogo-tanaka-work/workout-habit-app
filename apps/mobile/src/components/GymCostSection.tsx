import { Text, View } from 'react-native';

import { StatSummary } from './StatSummary';
import { styles } from '../styles/appStyles';
import { formatCount } from '../utils/number';
import type { GymCost } from '../utils/gymCost';

// 今月のジム代（1回あたり）。月額を設定していない人には出さない
// （使っていない機能を見せない。PlannedWorkoutSection と同じ扱い）。
//
// 主役の数値は「1回あたり」1つに絞る（.agents/DESIGN.md）。月額と回数は内訳として並べ、
// 「あと1回行くといくらになるか」を最後に1行で添える。次の1回の動機はここが担う。
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
      <View style={styles.sectionBody}>
        {cost.yenPerVisit === null ? (
          <Text style={styles.muted}>
            この月はまだ記録がありません。1回行くと {formatCount(monthlyFeeYen)}円/回 です。
          </Text>
        ) : (
          <>
            <StatSummary
              primary={{ label: '1回あたり', value: formatCount(cost.yenPerVisit), unit: '円' }}
              items={[
                { label: '行った回数', value: formatCount(cost.visitCount), unit: '回' },
                { label: '月額', value: formatCount(monthlyFeeYen), unit: '円' },
              ]}
            />
            <Text style={styles.faint}>
              あと1回行くと {formatCount(cost.yenPerVisitAfterNextVisit)}円/回 になります。
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
