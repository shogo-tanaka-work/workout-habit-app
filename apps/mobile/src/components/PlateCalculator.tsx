import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LabeledNumber } from './LabeledNumber';
import { styles } from '../styles/appStyles';
import { calculatePlates } from '../utils/plates';

const DEFAULT_TARGET_KG = 100;

// バーの種類。ジムに置いてある2種類＋自分で決める用。
const BARS = [
  { label: 'オリンピックバー', weightKg: 20 },
  { label: 'スタンダードバー', weightKg: 15 },
  { label: 'その他', weightKg: null },
] as const;

const DEFAULT_CUSTOM_BAR_KG = 10;

// プレート計算機。設定重量とバーから、片側に付けるプレートを出す。
//
// 見るのはジムのラックの前で、両手が塞がっている状況。枚数を数える手間を減らすため、
// 1枚ずつ行に分けて大きく出し、合計重量も併記する。
export function PlateCalculator() {
  const [targetWeightKg, setTargetWeightKg] = useState(DEFAULT_TARGET_KG);
  const [barIndex, setBarIndex] = useState(0);
  const [customBarKg, setCustomBarKg] = useState(DEFAULT_CUSTOM_BAR_KG);

  const bar = BARS[barIndex] ?? BARS[0];
  const barWeightKg = bar.weightKg ?? customBarKg;

  const isUnderBar = targetWeightKg < barWeightKg;
  const result = calculatePlates(targetWeightKg, barWeightKg);
  // 実際に組める重量。端数が出たぶんは設定重量に届かない。
  const plateWeightPerSide = result.perSide.reduce(
    (total, plate) => total + plate.weightKg * plate.count,
    0,
  );
  const achievableKg = barWeightKg + plateWeightPerSide * 2;

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>設定重量</Text>
        </View>
        <View style={styles.sectionBody}>
          <LabeledNumber
            label="バーとプレートの合計"
            value={targetWeightKg}
            suffix="kg"
            onChange={setTargetWeightKg}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>バー</Text>
        </View>
        <View style={styles.sectionBody}>
          <View style={styles.chipWrap}>
            {BARS.map((candidate, index) => {
              const isActive = index === barIndex;
              return (
                <Pressable
                  key={candidate.label}
                  style={[styles.choiceChip, isActive && styles.activePill]}
                  onPress={() => setBarIndex(index)}
                >
                  <Text style={[styles.choiceChipText, isActive && styles.activePillText]}>
                    {candidate.label}
                    {candidate.weightKg !== null ? ` ${candidate.weightKg}kg` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {bar.weightKg === null ? (
            <LabeledNumber
              label="バー重量"
              value={customBarKg}
              suffix="kg"
              onChange={setCustomBarKg}
            />
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>片側に付けるプレート</Text>
          <Text style={styles.faint}>左右それぞれ</Text>
        </View>

        {isUnderBar ? (
          <View style={styles.sectionBody}>
            <Text style={styles.muted}>
              バーの重量（{barWeightKg} kg）だけで設定重量を超えています。
            </Text>
          </View>
        ) : result.perSide.length === 0 ? (
          <View style={styles.sectionBody}>
            <Text style={styles.muted}>プレートなし（バーのみ）です。</Text>
          </View>
        ) : (
          result.perSide.map((plate) => (
            <View key={plate.weightKg} style={styles.plateRow}>
              <Text style={styles.plateWeight}>{plate.weightKg} kg</Text>
              <Text style={styles.plateCount}>× {plate.count}</Text>
            </View>
          ))
        )}

        <View style={styles.sectionBody}>
          <View style={styles.rowBetween}>
            <Text style={styles.muted}>合計重量</Text>
            <Text style={styles.plateTotal}>{achievableKg} kg</Text>
          </View>
          {result.remainderKg > 0 ? (
            <Text style={styles.accentNote}>
              片側 {result.remainderKg} kg は手持ちのプレートで組めないため、
              {achievableKg} kg までになります。
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
