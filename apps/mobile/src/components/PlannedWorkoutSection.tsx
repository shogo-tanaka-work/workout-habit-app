import { Alert, Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { formatSetsInline } from '../utils/aggregate';
import { formatTimer } from '../utils/format';
import { restSecondsFor } from '../utils/restPresets';
import { exerciseNameOf, exercisesInWorkout } from '../utils/workoutTree';

// Claude Code が立てた、その日の予定メニュー。予定が無いときは何も出さない
// （空状態を置くと、使っていない人にまで機能を見せることになる）。
//
// ホームの「選んだ日」パネルの中に置くので、自前の箱は持たず罫線で区切るだけにする。
//
// 予定は下書きであり、開始した後は普通の記録として扱う。
// 実施しながら重量やレップを直すことは想定内で、予定値は残らない。
//
// **破棄の導線をここに持たせる。** 予定を「開始」せずに別で記録を作ると、予定は
// planned のまま残るが、日詳細（完了・記録中だけを並べる）には出ないため、
// どこからも消せなくなっていた。破棄は開始と無関係なので、記録中でも出す。

export function PlannedWorkoutSection({
  plannedWorkouts,
  workoutExercises,
  visibleSets,
  exerciseById,
  hasActiveWorkout,
  onBegin,
  onDelete,
}: {
  plannedWorkouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  hasActiveWorkout: boolean;
  onBegin: (workoutId: string) => void;
  onDelete: (workoutId: string) => void;
}) {
  // 予定はサーバ側も含めて消える。取り消せないので確認を挟む。
  const confirmDelete = (workout: Workout) => {
    Alert.alert('予定を削除', `${workout.performedAt} の予定を削除します。元に戻せません。`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => onDelete(workout.id) },
    ]);
  };

  if (plannedWorkouts.length === 0) {
    return null;
  }

  return (
    <>
      {plannedWorkouts.map((workout) => {
        const items = exercisesInWorkout(workout.id, workoutExercises);
        return (
          <View key={workout.id} style={styles.exerciseRow}>
            <View style={styles.exerciseRowHeader}>
              <Text style={styles.exerciseRowName}>予定しているメニュー</Text>
              <Text style={styles.faint}>{items.length} 種目</Text>
            </View>
            <View style={styles.sectionBody}>
              {items.map((item) => {
                const exercise = exerciseById.get(item.exerciseId);
                const itemSets = visibleSets
                  .filter((set) => set.workoutExerciseId === item.id)
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                return (
                  <View key={item.id}>
                    <View style={styles.rowBetween}>
                      <View style={styles.inlineRow}>
                        <View
                          style={[
                            styles.exerciseDot,
                            { backgroundColor: bodyPartColor(exercise?.primaryBodyPartId) },
                          ]}
                        />
                        <Text style={styles.panelText}>
                          {exerciseNameOf(item.exerciseId, exerciseById)}
                        </Text>
                      </View>
                      <Text style={styles.muted}>{formatSetsInline(itemSets)}</Text>
                    </View>
                    {/* 休憩は目安。高重量のセットで長めに取ってかまわない。 */}
                    <Text style={styles.faint}>
                      休憩の目安 {formatTimer(restSecondsFor(item, exercise))}
                    </Text>
                  </View>
                );
              })}
              {workout.memo ? <Text style={styles.muted}>{workout.memo}</Text> : null}
              {hasActiveWorkout ? (
                // 進行中の記録があるうちは開始させない（active は同時に1つ）。
                <Text style={styles.faint}>
                  記録途中のワークアウトを終えると、この予定から始められます。
                </Text>
              ) : (
                <Pressable style={styles.secondaryButton} onPress={() => onBegin(workout.id)}>
                  <Text style={styles.secondaryButtonText}>この予定で開始</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.plannedDeleteButton}
                onPress={() => confirmDelete(workout)}
                accessibilityRole="button"
                accessibilityLabel={`${workout.performedAt} の予定を削除`}
              >
                <Text style={styles.deleteButtonText}>予定を削除</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </>
  );
}
