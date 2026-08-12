import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LabeledNumber } from './LabeledNumber';
import { styles } from '../styles/appStyles';
import type { BodyLog } from '../types/domain';

const BODY_WEIGHT_STEP_KG = 0.5;
const BODY_FAT_STEP_PERCENT = 0.5;

// 選んだ日の体重・体脂肪率を入れる。ホームの日詳細に置く。
//
// ボディログは日に紐づく（1日1件）ので、日を選ぶ操作を持つカレンダーの隣が入力の場所。
// 推移グラフは履歴タブが持つ。
//
// 日を切り替えたら入力状態も切り替わるよう、呼び出し側は key に日付を渡す。
export function BodyLogInput({
  date,
  log,
  latestLog,
  onSave,
}: {
  /** 対象の日（YYYY-MM-DD）。 */
  date: string;
  /** その日の記録。無ければ null。 */
  log: BodyLog | null;
  /** 直近の記録。その日が未記録のときの初期値に使う。 */
  latestLog: BodyLog | null;
  onSave: (measuredAt: string, bodyWeightKg: number, bodyFatPercentage: number | null) => void;
}) {
  const initial = log ?? latestLog;
  const [bodyWeightKg, setBodyWeightKg] = useState(initial?.bodyWeightKg ?? 0);
  const [bodyFatPercentage, setBodyFatPercentage] = useState(initial?.bodyFatPercentage ?? 0);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>ボディログ</Text>
        <Text style={styles.faint}>
          {log
            ? `${log.bodyWeightKg} kg${log.bodyFatPercentage !== null ? ` ・ ${log.bodyFatPercentage}%` : ''}`
            : 'この日は未記録'}
        </Text>
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
          onPress={() =>
            onSave(date, bodyWeightKg, bodyFatPercentage > 0 ? bodyFatPercentage : null)
          }
        >
          <Text style={styles.secondaryButtonText}>{log ? '上書き保存' : 'この日の値を保存'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
