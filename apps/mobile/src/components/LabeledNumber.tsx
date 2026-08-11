import { useId, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { styles } from '../styles/appStyles';
import { parseNumber } from '../utils/number';

// ステッパー付きの数値入力。
//
// **`decimal-pad` にはリターンキーが無い。** そのままだと入力を確定して次へ移るのに
// 画面のどこかをタップさせることになり、記録中に毎回その一手が挟まる。
// iOS ではキーボード上部にアクセサリを出して「完了」で閉じられるようにする
// （閉じると onEndEditing が走り、下の commit が呼ばれる）。

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
  const accessoryId = useId();
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

  // InputAccessoryView は iOS のみ。Android では ID を渡さず、既定の挙動に任せる。
  const isAccessorySupported = Platform.OS === 'ios';

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
          inputAccessoryViewID={isAccessorySupported ? accessoryId : undefined}
          style={styles.numberInput}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
        <Pressable style={styles.stepButton} onPress={() => updateByStep(stepAmount)}>
          <Text style={styles.stepButtonText}>+</Text>
        </Pressable>
      </View>
      {isAccessorySupported ? (
        <InputAccessoryView nativeID={accessoryId}>
          <View style={styles.keyboardAccessory}>
            <Pressable
              style={styles.keyboardAccessoryButton}
              onPress={() => {
                commit();
                Keyboard.dismiss();
              }}
            >
              <Text style={styles.keyboardAccessoryText}>完了</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}
