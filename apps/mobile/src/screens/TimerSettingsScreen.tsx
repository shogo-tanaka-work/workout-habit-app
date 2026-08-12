import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { TimerSettings } from '../types/domain';
import { REST_PRESET_LIMIT } from '../types/domain';
import { formatTimer } from '../utils/format';

// 共通タイマーを増減する刻み。ジムで使う値は30秒単位で足りる。
const STEP_SECONDS = 30;
const MAX_REST_SECONDS = 15 * 60;

// 休憩タイマーの設定。時間そのものは種目ごとに持つが、
// 種目をまたいで使い回す「共通タイマー」はここで編集する。
export function TimerSettingsScreen({
  timerSettings,
  onUpdate,
}: {
  timerSettings: TimerSettings;
  onUpdate: (settings: TimerSettings) => void;
}) {
  // 増減の対象。チップをタップして選び、下のボタンで動かす。
  const [selectedIndex, setSelectedIndex] = useState(0);
  const presets = timerSettings.restPresets;
  const activeIndex = Math.min(selectedIndex, Math.max(0, presets.length - 1));

  const savePresets = (next: number[]) => {
    onUpdate({ ...timerSettings, restPresets: next });
  };

  const stepSelected = (delta: number) => {
    const current = presets[activeIndex];
    if (current === undefined) {
      return;
    }
    const next = Math.min(MAX_REST_SECONDS, Math.max(STEP_SECONDS, current + delta));
    savePresets(presets.map((preset, index) => (index === activeIndex ? next : preset)));
  };

  const addPreset = () => {
    if (presets.length >= REST_PRESET_LIMIT) {
      return;
    }
    savePresets([...presets, presets[activeIndex] ?? 120]);
    setSelectedIndex(presets.length);
  };

  // 最後の1件は残す（共通タイマーが空になると選ぶものが無くなる）。
  const removePreset = () => {
    if (presets.length <= 1) {
      return;
    }
    savePresets(presets.filter((_, index) => index !== activeIndex));
    setSelectedIndex(Math.max(0, activeIndex - 1));
  };

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>休憩の終了通知</Text>
        </View>
        <View style={styles.sectionBody}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelText}>終了時に音を鳴らす</Text>
            <Switch
              value={timerSettings.soundEnabled}
              onValueChange={(soundEnabled) => onUpdate({ ...timerSettings, soundEnabled })}
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
            />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.panelText}>終了時に振動する</Text>
            <Switch
              value={timerSettings.vibrationEnabled}
              onValueChange={(vibrationEnabled) => onUpdate({ ...timerSettings, vibrationEnabled })}
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>共通タイマー</Text>
          <Text style={styles.faint}>
            {presets.length} / {REST_PRESET_LIMIT} 件
          </Text>
        </View>
        <View style={styles.sectionBody}>
          <Text style={styles.muted}>
            種目をまたいで使い回す休憩時間です。記録中の休憩タイマーから選べます。
          </Text>

          <View style={styles.chipWrap}>
            {presets.map((seconds, index) => {
              const isActive = index === activeIndex;
              return (
                <Pressable
                  key={`${index}-${seconds}`}
                  style={[styles.choiceChip, isActive && styles.activePill]}
                  onPress={() => setSelectedIndex(index)}
                >
                  <Text style={[styles.choiceChipText, isActive && styles.activePillText]}>
                    {formatTimer(seconds)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.muted}>選んだ時間を変える</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.stepButton} onPress={() => stepSelected(-STEP_SECONDS)}>
                <Text style={styles.stepButtonText}>-</Text>
              </Pressable>
              <Text style={styles.plateTotal}>{formatTimer(presets[activeIndex] ?? 0)}</Text>
              <Pressable style={styles.stepButton} onPress={() => stepSelected(STEP_SECONDS)}>
                <Text style={styles.stepButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={[
                styles.ghostButton,
                styles.flex,
                presets.length >= REST_PRESET_LIMIT && styles.disabledPill,
              ]}
              disabled={presets.length >= REST_PRESET_LIMIT}
              onPress={addPreset}
            >
              <Text style={styles.ghostButtonText}>＋ 追加</Text>
            </Pressable>
            <Pressable
              style={[styles.ghostButton, styles.flex, presets.length <= 1 && styles.disabledPill]}
              disabled={presets.length <= 1}
              onPress={removePreset}
            >
              <Text style={styles.ghostButtonText}>− 削除</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
