import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { LabeledNumber } from '../components/LabeledNumber';
import { TrainingPhaseSection } from '../components/TrainingPhaseSection';
import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { TrainingGoal, TrainingPhase, TrainingPhaseKind, UserProfile } from '../types/domain';
import { DEFAULT_TRAINING_GOAL, TRAINING_GOAL_OPTIONS } from '../utils/trainingProfile';

// トレーニング設定（設定タブのサブ画面）。
//
// 期間で変わるもの（フェーズ）と、恒常的に持つもの（目的・身長・メモ）をここへ集める。
// どちらも計画立案の前提で、これまで Claude Code 経由でしか書けなかった。
//
// 身長の入力に 0 を使う: LabeledNumber は数値だけを扱うため、未入力を別の状態として
// 持たせると入力部品の側に「空」の概念が要る。ボディログの体脂肪率と同じく
// 0 を未入力として扱い、保存時に null へ寄せる。
const HEIGHT_STEP_CM = 0.5;
const UNSET_HEIGHT_CM = 0;

export function TrainingSettingsScreen({
  userProfile,
  currentPhase,
  onSaveProfile,
  onSwitchPhase,
}: {
  /** 保存済みの基本情報。未設定なら null。 */
  userProfile: UserProfile | null;
  currentPhase: TrainingPhase | null;
  onSaveProfile: (profile: {
    trainingGoal: TrainingGoal;
    heightCm: number | null;
    note: string;
  }) => void;
  onSwitchPhase: (params: { phase: TrainingPhaseKind; startedOn: string; note: string }) => void;
}) {
  // 保存済みの値が選択肢に無い（サーバが値を増やした等）ときは既定へ落とす。
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal>(
    () =>
      TRAINING_GOAL_OPTIONS.find((option) => option.value === userProfile?.trainingGoal)?.value ??
      DEFAULT_TRAINING_GOAL,
  );
  const [heightCm, setHeightCm] = useState(userProfile?.heightCm ?? UNSET_HEIGHT_CM);
  const [note, setNote] = useState(userProfile?.note ?? '');

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>基本情報</Text>
          <Text style={styles.faint}>{userProfile ? '保存済み' : '未設定'}</Text>
        </View>
        <View style={styles.sectionBody}>
          <Text style={styles.inputLabel}>目的</Text>
          <Text style={styles.muted}>
            評価の見方が変わります。筋力向上ならトップ重量と推定1RM、筋肥大なら総ボリュームを主に見ます。
          </Text>
          <View style={styles.chipWrap}>
            {TRAINING_GOAL_OPTIONS.map((option) => {
              const isActive = option.value === trainingGoal;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.choiceChip, isActive && styles.activePill]}
                  onPress={() => setTrainingGoal(option.value)}
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

          <View style={styles.inputGrid}>
            <LabeledNumber
              label="身長"
              value={heightCm}
              suffix="cm"
              step={HEIGHT_STEP_CM}
              onChange={setHeightCm}
            />
          </View>
          <Text style={styles.faint}>
            任意。体組成の指標（FFMI）にだけ使います。0 のままなら未設定として保存します。
          </Text>

          <Text style={styles.inputLabel}>メモ</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="制約や方針（例: 火木土に通う・腰に不安）"
            placeholderTextColor={colors.textFaint}
            multiline
            style={styles.noteInput}
          />

          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              onSaveProfile({
                trainingGoal,
                heightCm: heightCm > UNSET_HEIGHT_CM ? heightCm : null,
                note: note.trim(),
              })
            }
          >
            <Text style={styles.secondaryButtonText}>基本情報を保存</Text>
          </Pressable>
        </View>
      </View>

      <TrainingPhaseSection currentPhase={currentPhase} onSwitch={onSwitchPhase} />
    </View>
  );
}
