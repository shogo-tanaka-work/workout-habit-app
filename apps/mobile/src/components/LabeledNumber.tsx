import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { parseNumber } from '../utils/number';

export function LabeledNumber({
  label,
  value,
  suffix,
  onChange,
  step,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
  // ステッパーの刻み幅。省略時は kg なら 2.5、それ以外は 1。
  step?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // 親から渡る value が変わったら入力ドラフトを同期する。
  // effect ではなくレンダー中の state 調整（React 公式推奨パターン）で再レンダーを抑える。
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  const commit = () => {
    onChange(parseNumber(draft, value));
  };

  const stepAmount = step ?? (suffix === 'kg' ? 2.5 : 1);
  const updateByStep = (delta: number) => {
    const next = Math.max(0, Math.round((value + delta) * 100) / 100);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <View style={styles.numberField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.numberRow}>
        <Pressable style={styles.stepButton} onPress={() => updateByStep(-stepAmount)}>
          <Text style={styles.stepButtonText}>-</Text>
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onEndEditing={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          style={styles.numberInput}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        <Pressable style={styles.stepButton} onPress={() => updateByStep(stepAmount)}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
