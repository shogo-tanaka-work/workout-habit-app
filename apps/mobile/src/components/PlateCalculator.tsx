import { useState } from 'react';
import { Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { calculatePlates, formatPlateResult } from '../utils/plates';
import { LabeledNumber } from './LabeledNumber';

const DEFAULT_TARGET_KG = 100;
const DEFAULT_BAR_KG = 20;

// プレート計算機（Phase 2）。目標重量とバー重量から片側のプレート構成を出す。
export function PlateCalculator() {
  const [targetWeightKg, setTargetWeightKg] = useState(DEFAULT_TARGET_KG);
  const [barWeightKg, setBarWeightKg] = useState(DEFAULT_BAR_KG);

  const isUnderBar = targetWeightKg < barWeightKg;
  const result = calculatePlates(targetWeightKg, barWeightKg);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>プレート計算機</Text>
      </View>
      <View style={styles.sectionBody}>
        <View style={styles.inputGrid}>
          <LabeledNumber
            label="目標重量"
            value={targetWeightKg}
            suffix="kg"
            onChange={setTargetWeightKg}
          />
          <LabeledNumber
            label="バー重量"
            value={barWeightKg}
            suffix="kg"
            onChange={setBarWeightKg}
          />
        </View>
        {isUnderBar ? (
          <Text style={styles.muted}>目標重量がバー重量より軽いため、プレートは不要です。</Text>
        ) : (
          <>
            <Text style={styles.accentNote}>片側: {formatPlateResult(result)}</Text>
            {result.remainderKg > 0 ? (
              <Text style={styles.faint}>
                残り {result.remainderKg} kg（片側）は標準プレートでは組めません。
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
