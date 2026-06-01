import { Pressable, Text, TextInput, View } from 'react-native';

import { styles } from '../styles/appStyles';
import type { BodyPart, Exercise } from '../types/domain';
import { formatTimer } from '../utils/format';

export function ExerciseScreen({
  bodyParts,
  exercises,
  bodyPartById,
  newExerciseName,
  onChangeNewExerciseName,
  onAddCustomExercise,
  onOpenRestPicker,
}: {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  bodyPartById: Map<string, BodyPart>;
  newExerciseName: string;
  onChangeNewExerciseName: (value: string) => void;
  onAddCustomExercise: () => void;
  onOpenRestPicker: (exerciseId: string, seconds: number) => void;
}) {
  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>種目を追加</Text>
        <TextInput
          value={newExerciseName}
          onChangeText={onChangeNewExerciseName}
          placeholder="例: インクラインダンベルプレス"
          placeholderTextColor="#7a7f8a"
          style={styles.textInput}
        />
        <Pressable style={styles.primaryButton} onPress={onAddCustomExercise}>
          <Text style={styles.primaryButtonText}>種目を登録</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>部位マスター</Text>
        <View style={styles.chipWrap}>
          {bodyParts.map((part) => (
            <View key={part.id} style={styles.staticChip}>
              <Text style={styles.staticChipText}>{part.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {exercises.map((exercise) => {
        const bodyPart = bodyPartById.get(exercise.primaryBodyPartId);
        return (
          <View key={exercise.id} style={styles.panel}>
            <Text style={styles.exerciseTitle}>{exercise.name}</Text>
            <Text style={styles.muted}>
              {bodyPart?.name ?? '未分類'} / バー {exercise.defaultBarWeightKg}kg
            </Text>
            <Pressable
              style={styles.restRow}
              onPress={() => onOpenRestPicker(exercise.id, exercise.defaultRestSeconds)}
            >
              <Text style={styles.muted}>デフォルト休憩</Text>
              <Text style={styles.restValue}>{formatTimer(exercise.defaultRestSeconds)} ›</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
