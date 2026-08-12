import { useId, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { styles } from '../styles/appStyles';
import type { SetPatch, WorkoutSet } from '../types/domain';
import { parseNumber } from '../utils/number';

// 記録中の1種目ぶんのセット表。**セットを列に並べる**（参考UI準拠）。
//
// 1行1セットで縦に積むと、5セット目あたりで下の「過去5回分の記録」が画面外へ押し出される。
// 列に並べれば、セットが増えても表の高さは変わらない（溢れたぶんは横スクロール）。
//
// ジムで触るのは「重量」「回数」「完了」の3つだけ。それ以外（ウォームアップ・コピー・
// 削除・メモ）はセット番号のタップから開くシートへ逃がし、表にボタンを増やさない。

// 表内の数値セル。decimal-pad にはリターンキーが無いため、iOS ではキーボード上部の
// 「完了」で確定できるようにする（詳細は components/LabeledNumber.tsx と同じ理由）。
function NumberCell({
  value,
  accessoryId,
  onChange,
}: {
  value: number;
  accessoryId: string | undefined;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // 親から渡る値が変わったら入力ドラフトを同期する（レンダー中の state 調整）。
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onEndEditing={() => onChange(parseNumber(draft, value))}
      onSubmitEditing={() => onChange(parseNumber(draft, value))}
      keyboardType="decimal-pad"
      inputAccessoryViewID={accessoryId}
      selectTextOnFocus
      style={styles.setLogInput}
    />
  );
}

export function SetLogTable({
  sets,
  onPatchSet,
  onOpenSetActions,
}: {
  /** 表示順に並んだ、削除されていないセット。 */
  sets: WorkoutSet[];
  onPatchSet: (setId: string, patch: SetPatch) => void;
  onOpenSetActions: (set: WorkoutSet, setNumber: number) => void;
}) {
  const accessoryId = useId();
  const isAccessorySupported = Platform.OS === 'ios';

  if (sets.length === 0) {
    return (
      <View style={styles.sectionBody}>
        <Text style={styles.logNote}>「＋ セット」で1セット目を作ると、すぐ保存されます。</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.setLogRow}>
          <View style={styles.setLogLabelCell}>
            <Text style={styles.setLogLabelText}>セット</Text>
          </View>
          {sets.map((set, index) => (
            <Pressable
              key={set.id}
              style={styles.setLogCell}
              onPress={() => onOpenSetActions(set, index + 1)}
              accessibilityRole="button"
              accessibilityLabel={`セット ${index + 1} の操作`}
            >
              <Text style={[styles.setLogNumberText, set.isWarmup && styles.setLogWarmupText]}>
                {set.isWarmup ? 'WU' : index + 1}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.setLogRow}>
          <View style={styles.setLogLabelCell}>
            <Text style={styles.setLogLabelText}>重量</Text>
          </View>
          {sets.map((set) => (
            <View key={set.id} style={styles.setLogCell}>
              <NumberCell
                value={set.weightKg}
                accessoryId={isAccessorySupported ? accessoryId : undefined}
                onChange={(weightKg) => onPatchSet(set.id, { weightKg })}
              />
              <Text style={styles.setLogUnit}>kg</Text>
            </View>
          ))}
        </View>

        <View style={styles.setLogRow}>
          <View style={styles.setLogLabelCell}>
            <Text style={styles.setLogLabelText}>回数</Text>
          </View>
          {sets.map((set) => (
            <View key={set.id} style={styles.setLogCell}>
              <NumberCell
                value={set.reps}
                accessoryId={isAccessorySupported ? accessoryId : undefined}
                onChange={(reps) => onPatchSet(set.id, { reps: Math.max(0, Math.round(reps)) })}
              />
              <Text style={styles.setLogUnit}>回</Text>
            </View>
          ))}
        </View>

        <View style={[styles.setLogRow, styles.setLogRowLast]}>
          <View style={styles.setLogLabelCell}>
            <Text style={styles.setLogLabelText}>完了</Text>
          </View>
          {sets.map((set, index) => (
            <Pressable
              key={set.id}
              style={styles.setLogCell}
              onPress={() => onPatchSet(set.id, { isCompleted: !set.isCompleted })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.isCompleted }}
              accessibilityLabel={`セット ${index + 1} を完了`}
            >
              <Text style={[styles.setLogCheckText, set.isCompleted && styles.setLogCheckTextDone]}>
                {set.isCompleted ? '✓' : '○'}
              </Text>
            </Pressable>
          ))}
        </View>

        {isAccessorySupported ? (
          <InputAccessoryView nativeID={accessoryId}>
            <View style={styles.keyboardAccessory}>
              <Pressable style={styles.keyboardAccessoryButton} onPress={() => Keyboard.dismiss()}>
                <Text style={styles.keyboardAccessoryText}>完了</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        ) : null}
      </View>
    </ScrollView>
  );
}
