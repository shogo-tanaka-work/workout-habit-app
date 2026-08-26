import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { Exercise } from '../types/domain';

// 種目を1件選ばせる行。
//
// 部位ごとの種目一覧（ExerciseSelectList）と、記録タブの「今日のメニュー」
// （ExercisePicker）が共有する。同じ「種目を選ぶ」操作なので、
// 並ぶ場所が違っても見た目と当たり判定を変えない。
export function ExerciseRow({
  exercise,
  note,
  onPress,
}: {
  exercise: Exercise;
  /** 行の右端に出す一言（今日のセット数・前回からの日数など）。 */
  note?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.exerciseRow} onPress={onPress}>
      <View style={styles.exercisePickerRow}>
        <View
          style={[
            styles.exerciseDot,
            { backgroundColor: bodyPartColor(exercise.primaryBodyPartId) },
          ]}
        />
        <Text style={styles.exercisePickerName}>{exercise.name}</Text>
        {note ? <Text style={styles.muted}>{note}</Text> : null}
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}
