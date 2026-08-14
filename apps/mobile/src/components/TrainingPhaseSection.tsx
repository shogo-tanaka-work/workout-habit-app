import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DatePickerModal } from './DatePickerModal';
import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { TrainingPhase, TrainingPhaseKind } from '../types/domain';
import { daysBetween, formatDate } from '../utils/datetime';
import {
  DEFAULT_TRAINING_PHASE,
  TRAINING_PHASE_OPTIONS,
  phaseLabelOf,
} from '../utils/trainingProfile';

// 現在のフェーズ（減量期・増量期・維持期・中断）の表示と切り替え。
//
// フェーズは実績データの読み方を左右する（中断期間の記録の少なさは停滞ではない）。
// 切り替えると前のフェーズが自動で終了するため、押す前にそれが読める位置へ注意書きを置く。
export function TrainingPhaseSection({
  currentPhase,
  onSwitch,
}: {
  /** 進行中のフェーズ。未設定なら null。判定は useWorkoutStore が持つ。 */
  currentPhase: TrainingPhase | null;
  onSwitch: (params: { phase: TrainingPhaseKind; startedOn: string; note: string }) => void;
}) {
  const today = formatDate(new Date());
  const [phase, setPhase] = useState<TrainingPhaseKind>(
    () =>
      TRAINING_PHASE_OPTIONS.find((option) => option.value === currentPhase?.phase)?.value ??
      DEFAULT_TRAINING_PHASE,
  );
  const [startedOn, setStartedOn] = useState(today);
  // 方針・制約（「断酒中」「回復優先」など）。1文字ごとに書かず、切り替えのときにまとめて保存する。
  const [note, setNote] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>現在のフェーズ</Text>
        <Text style={styles.faint}>
          {currentPhase ? `${phaseLabelOf(currentPhase.phase)}・進行中` : '未設定'}
        </Text>
      </View>
      <View style={styles.sectionBody}>
        {currentPhase ? (
          <>
            <Text style={styles.panelText}>
              {phaseLabelOf(currentPhase.phase)}　{currentPhase.startedOn}〜（
              {daysBetween(currentPhase.startedOn, today) + 1}日目）
            </Text>
            {currentPhase.note ? <Text style={styles.muted}>{currentPhase.note}</Text> : null}
          </>
        ) : (
          <Text style={styles.muted}>
            フェーズはまだありません。下で選んで切り替えると、ここに出ます。
          </Text>
        )}

        <Text style={styles.inputLabel}>フェーズを切り替える</Text>
        <View style={styles.chipWrap}>
          {TRAINING_PHASE_OPTIONS.map((option) => {
            const isActive = option.value === phase;
            return (
              <Pressable
                key={option.value}
                style={[styles.choiceChip, isActive && styles.activePill]}
                onPress={() => setPhase(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.choiceChipText, isActive && styles.activePillText]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.muted}>開始日</Text>
          <Pressable style={styles.smallButton} onPress={() => setIsDatePickerOpen(true)}>
            <Text style={styles.smallButtonText}>{startedOn}</Text>
          </Pressable>
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="このフェーズの方針（例: 断酒中・回復優先）"
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.noteInput}
        />

        <Text style={styles.muted}>
          切り替えると、進行中のフェーズは開始日の前日で自動的に終了します。
        </Text>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => onSwitch({ phase, startedOn, note: note.trim() })}
        >
          <Text style={styles.secondaryButtonText}>このフェーズに切り替える</Text>
        </Pressable>
      </View>

      {isDatePickerOpen ? (
        <DatePickerModal
          value={startedOn}
          onConfirm={(isoDate) => {
            setStartedOn(isoDate);
            setIsDatePickerOpen(false);
          }}
          onCancel={() => setIsDatePickerOpen(false)}
        />
      ) : null}
    </View>
  );
}
