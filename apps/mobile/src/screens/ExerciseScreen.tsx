import { Pressable, Switch, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { colors } from '../styles/theme';
import type { BodyPart, Exercise, TimerSettings } from '../types/domain';
import { formatTimer } from '../utils/format';

export function ExerciseScreen({
  bodyParts,
  exercises,
  bodyPartById,
  newExerciseName,
  timerSettings,
  onChangeNewExerciseName,
  onAddCustomExercise,
  onOpenRestPicker,
  onSelectExercise,
  onUpdateTimerSettings,
}: {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  bodyPartById: Map<string, BodyPart>;
  newExerciseName: string;
  timerSettings: TimerSettings;
  onChangeNewExerciseName: (value: string) => void;
  onAddCustomExercise: () => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
  onSelectExercise: (exerciseId: string) => void;
  onUpdateTimerSettings: (settings: TimerSettings) => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>タイマー設定</Text>
        </View>
        <View style={styles.sectionBody}>
          <View style={styles.rowBetween}>
            <Text style={styles.panelText}>終了時に音を鳴らす</Text>
            <Switch
              value={timerSettings.soundEnabled}
              onValueChange={(soundEnabled) =>
                onUpdateTimerSettings({ ...timerSettings, soundEnabled })
              }
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
            />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.panelText}>終了時に振動する</Text>
            <Switch
              value={timerSettings.vibrationEnabled}
              onValueChange={(vibrationEnabled) =>
                onUpdateTimerSettings({ ...timerSettings, vibrationEnabled })
              }
              trackColor={{ true: colors.accent, false: colors.surfaceRaised }}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>種目を追加</Text>
        </View>
        <View style={styles.sectionBody}>
          <TextInput
            value={newExerciseName}
            onChangeText={onChangeNewExerciseName}
            placeholder="例: インクラインダンベルプレス"
            placeholderTextColor={colors.textFaint}
            style={styles.textInput}
          />
          <Pressable style={styles.primaryButton} onPress={onAddCustomExercise}>
            <Text style={styles.primaryButtonText}>種目を登録</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>部位マスター</Text>
        </View>
        <View style={styles.sectionBody}>
          <View style={styles.chipWrap}>
            {bodyParts.map((part) => (
              <View key={part.id} style={styles.staticChip}>
                <Text style={styles.staticChipText}>{part.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>種目一覧</Text>
        </View>
        {exercises.map((exercise) => {
          const bodyPart = bodyPartById.get(exercise.primaryBodyPartId);
          return (
            <View key={exercise.id} style={styles.exerciseRow}>
              <Pressable
                style={styles.exerciseRowHeader}
                onPress={() => onSelectExercise(exercise.id)}
              >
                <View style={styles.exerciseDot} />
                <View style={styles.flex}>
                  <Text style={styles.exerciseRowName}>{exercise.name}</Text>
                  <Text style={styles.faint}>
                    {bodyPart?.name ?? '未分類'} ・ バー {exercise.defaultBarWeightKg} kg
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <View style={styles.sectionBody}>
                <Pressable
                  style={styles.restRow}
                  onPress={() => onOpenRestPicker(exercise.id, exercise.defaultRestSeconds)}
                >
                  <Text style={styles.muted}>デフォルト休憩</Text>
                  <Text style={styles.restValue}>{formatTimer(exercise.defaultRestSeconds)} ›</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
