import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { parseNumber } from '../utils/number';

export function LabeledNumber({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
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

  const step = suffix === 'kg' ? 2.5 : 1;
  const updateByStep = (delta: number) => {
    const next = Math.max(0, value + delta);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <View style={styles.numberField}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.numberRow}>
        <Pressable style={styles.stepButton} onPress={() => updateByStep(-step)}>
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
        <Pressable style={styles.stepButton} onPress={() => updateByStep(step)}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
