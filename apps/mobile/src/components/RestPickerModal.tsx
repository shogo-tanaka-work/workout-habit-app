import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import { REST_PRESET_LIMIT } from '../types/domain';
import { formatTimer } from '../utils/format';

type Mode = 'exercise' | 'shared';

const clampSeconds = (seconds: number) => Math.max(0, Math.min(15 * 60 + 55, seconds));

// 休憩時間を決める中央ポップアップ。
//
// 種目タイマー（この種目だけの1件）と共通タイマー（種目をまたいで使い回す最大3件）を
// タブで切り替える。どちらのタブでも「決定」は、いま表示している秒数をこの種目へ適用する。
export function RestPickerModal({
  value,
  presets,
  onConfirm,
  onCancel,
}: {
  value: number;
  /** 共通タイマー（秒）。最大 REST_PRESET_LIMIT 件。 */
  presets: number[];
  onConfirm: (seconds: number, presets: number[]) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>('exercise');
  // 種目タイマーの編集値。共通タブへ行って戻っても、この種目の値は保つ。
  const [exerciseSeconds, setExerciseSeconds] = useState(clampSeconds(value));
  const [draftPresets, setDraftPresets] = useState<number[]>(
    presets.length > 0 ? presets.map(clampSeconds) : [clampSeconds(value)],
  );
  const [presetIndex, setPresetIndex] = useState(() => {
    const found = presets.findIndex((preset) => preset === value);
    return found >= 0 ? found : 0;
  });

  const currentSeconds =
    mode === 'exercise' ? exerciseSeconds : (draftPresets[presetIndex] ?? exerciseSeconds);
  const minutes = Math.floor(currentSeconds / 60);
  const seconds = Math.round((currentSeconds % 60) / 5) * 5;

  const setCurrentSeconds = (next: number) => {
    const clamped = clampSeconds(next);
    if (mode === 'exercise') {
      setExerciseSeconds(clamped);
      return;
    }
    setDraftPresets((previous) =>
      previous.map((preset, index) => (index === presetIndex ? clamped : preset)),
    );
  };

  // 共通タイマーは上限まで。いまの値を複製して足し、そのまま編集対象にする。
  const addPreset = () => {
    if (draftPresets.length >= REST_PRESET_LIMIT) {
      return;
    }
    setDraftPresets((previous) => [...previous, currentSeconds]);
    setPresetIndex(draftPresets.length);
  };

  // 最後の1件は残す（共通タイマーが空になると選ぶものが無くなる）。
  const removePreset = () => {
    if (draftPresets.length <= 1) {
      return;
    }
    setDraftPresets((previous) => previous.filter((_, index) => index !== presetIndex));
    setPresetIndex((previous) => Math.max(0, previous - 1));
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <Pressable style={styles.dialogBackdrop} onPress={onCancel}>
        <Pressable style={styles.dialogCard} onPress={() => undefined}>
          <Text style={styles.sectionTitle}>休憩タイマー</Text>
          <Text style={styles.muted}>セット完了後に使う休憩時間です。</Text>

          <View style={styles.segmentRow}>
            {(
              [
                ['exercise', '種目タイマー'],
                ['shared', '共通タイマー'],
              ] as const
            ).map(([key, label], index) => (
              <Pressable
                key={key}
                style={[
                  styles.segment,
                  index === 1 && styles.segmentLast,
                  mode === key && styles.segmentActive,
                ]}
                onPress={() => setMode(key)}
              >
                <Text style={[styles.segmentText, mode === key && styles.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'shared' ? (
            <View style={styles.presetRow}>
              <View style={styles.presetChips}>
                {draftPresets.map((preset, index) => (
                  <Pressable
                    key={`${index}-${preset}`}
                    style={[styles.presetChip, index === presetIndex && styles.presetChipActive]}
                    onPress={() => setPresetIndex(index)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        index === presetIndex && styles.presetChipTextActive,
                      ]}
                    >
                      {formatTimer(preset)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[
                  styles.presetIconButton,
                  draftPresets.length >= REST_PRESET_LIMIT && styles.presetIconButtonDisabled,
                ]}
                onPress={addPreset}
              >
                <Text style={styles.presetIconText}>＋</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.presetIconButton,
                  draftPresets.length <= 1 && styles.presetIconButtonDisabled,
                ]}
                onPress={removePreset}
              >
                <Text style={styles.presetIconText}>−</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.pickerRow}>
            <Picker
              selectedValue={minutes}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              onValueChange={(next) => setCurrentSeconds(Number(next) * 60 + seconds)}
            >
              {Array.from({ length: 16 }, (_, index) => index).map((minute) => (
                <Picker.Item
                  key={minute}
                  label={`${minute}`}
                  value={minute}
                  color={colors.textPrimary}
                />
              ))}
            </Picker>
            <Text style={styles.pickerUnit}>分</Text>
            <Picker
              selectedValue={seconds}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              onValueChange={(next) => setCurrentSeconds(minutes * 60 + Number(next))}
            >
              {Array.from({ length: 12 }, (_, index) => index * 5).map((second) => (
                <Picker.Item
                  key={second}
                  label={`${second.toString().padStart(2, '0')}`}
                  value={second}
                  color={colors.textPrimary}
                />
              ))}
            </Picker>
            <Text style={styles.pickerUnit}>秒</Text>
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.ghostButton} onPress={onCancel}>
              <Text style={styles.ghostButtonText}>キャンセル</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButtonFlat}
              onPress={() => onConfirm(currentSeconds, draftPresets)}
            >
              <Text style={styles.primaryButtonText}>決定</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
