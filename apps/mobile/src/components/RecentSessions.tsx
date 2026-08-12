import { Text, View } from 'react-native';

import { SetTable } from './SetTable';
import { styles } from '../styles/appStyles';
import type { ExerciseSession } from '../utils/aggregate';
import { formatJapaneseDate } from '../utils/datetime';
import { formatCount, formatVolume, formatWeight } from '../utils/number';

// 記録中の種目の、直近の実施記録。
//
// 「前回どうだったっけ」は1回ぶんでは足りない（前回が調子の悪い日だったこともある）。
// 数回ぶんを同じ形の表で並べて、伸びているかを目で追えるようにする。
export function RecentSessions({ sessions }: { sessions: ExerciseSession[] }) {
  if (sessions.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionBody}>
          <Text style={styles.logNote}>
            この種目は初めてです。今日の記録が次回の目安になります。
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>過去 {sessions.length} 回分の記録</Text>
      </View>
      {sessions.map((session) => (
        <View key={session.workout.id} style={styles.exerciseRow}>
          <View style={styles.exerciseRowHeader}>
            <Text style={styles.exerciseRowName}>
              {formatJapaneseDate(session.workout.performedAt)}
            </Text>
          </View>
          <View style={styles.sectionBody}>
            <SetTable sets={session.sets} />
            <Text style={styles.muted}>
              ボリューム {formatVolume(session.summary.totalVolume)} ・ 推定1RM{' '}
              {formatWeight(session.summary.bestOneRepMax)} ・ 総レップ{' '}
              {formatCount(session.summary.totalReps)} 回
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
