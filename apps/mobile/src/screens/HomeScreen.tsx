import { useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';

import { MonthCalendar } from '../components/MonthCalendar';
import { PlannedWorkoutSection } from '../components/PlannedWorkoutSection';
import { StatSummary } from '../components/StatSummary';
import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { formatSetsInline, summarizeSets } from '../utils/aggregate';
import { buildDayMarks } from '../utils/calendarMarks';
import { formatDate, formatJapaneseDate } from '../utils/datetime';
import { formatCount } from '../utils/number';

// 下半分（選んだ日の内容）の最小高さ。これ以下だと1種目も読めない。
const MIN_DETAIL_HEIGHT = 140;
// カレンダーを詰めてよい下限。ヘッダー＋曜日行＋2週ぶんが残る想定。
const MIN_CALENDAR_HEIGHT = 160;
// ドラッグ用グラバーの高さ。styles.dragHandle と揃える。
const HANDLE_HEIGHT = 32;
// この量より小さい縦移動はタップ扱いにして、ドラッグを始めない。
const DRAG_THRESHOLD = 2;

type PaneLayout = {
  container: number;
  /** カレンダーを詰めずに全部出したときの高さ。 */
  calendar: number;
  /** 週1行の高さ。離したときに週単位へスナップするために使う。 */
  weekRow: number;
};

const clampDetailHeight = (value: number, layout: PaneLayout): number => {
  const max = layout.container - HANDLE_HEIGHT - MIN_CALENDAR_HEIGHT;
  if (max < MIN_DETAIL_HEIGHT) {
    return MIN_DETAIL_HEIGHT;
  }
  return Math.min(Math.max(value, MIN_DETAIL_HEIGHT), max);
};

// カレンダーが週の途中で切れないよう、離した位置を週単位の境目へ寄せる。
const snapDetailHeight = (value: number, layout: PaneLayout): number => {
  if (layout.weekRow <= 0) {
    return value;
  }
  const fullyVisible = layout.container - HANDLE_HEIGHT - layout.calendar;
  const hiddenWeeks = Math.max(0, Math.round((value - fullyVisible) / layout.weekRow));
  return clampDetailHeight(fullyVisible + hiddenWeeks * layout.weekRow, layout);
};

// 実測値の反映。値が変わらないときは同じオブジェクトを返し、
// ドラッグ中に PanResponder が作り直されてジェスチャが切れるのを防ぐ。
const withMeasured =
  (key: keyof PaneLayout, height: number) =>
  (current: PaneLayout): PaneLayout =>
    current[key] === height ? current : { ...current, [key]: height };

// ホームは「実績が一望できる画面」。上半分の月間カレンダーは固定し、
// 下半分（選んだ日の内容）だけがスクロールする。境目のグラバーで配分を変えられる。
// 週次の集計や体組成の推移は履歴タブが持つ。
export function HomeScreen({
  activeWorkout,
  completedWorkouts,
  plannedWorkouts,
  workoutExercises,
  visibleSets,
  exerciseById,
  onResume,
  onBeginPlanned,
  onEditWorkout,
  onSelectExercise,
}: {
  activeWorkout: Workout | null;
  completedWorkouts: Workout[];
  plannedWorkouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  onResume: () => void;
  onBeginPlanned: (workoutId: string) => void;
  onEditWorkout: (workoutId: string) => void;
  onSelectExercise: (exerciseId: string) => void;
}) {
  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);

  const [layout, setLayout] = useState<PaneLayout>({ container: 0, calendar: 0, weekRow: 0 });
  // グラバーで決めた下半分の高さ（height）と、ドラッグを始めたときの高さ（start）。
  // 途中の値を ref に持たずに済むよう、状態は1つにまとめて関数形式で更新する。
  const [drag, setDrag] = useState<{ height: number | null; start: number }>({
    height: null,
    start: 0,
  });

  // 未操作のときの配分。カレンダーを全部見せて、残りを下半分に渡す。
  const defaultDetailHeight = layout.container - HANDLE_HEIGHT - layout.calendar;
  const resolvedDetailHeight = clampDetailHeight(drag.height ?? defaultDetailHeight, layout);

  const panResponder = useMemo(() => {
    const heightFromGesture = (start: number, dy: number) => clampDetailHeight(start - dy, layout);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > DRAG_THRESHOLD,
      onPanResponderGrant: () => {
        setDrag((current) => ({
          ...current,
          start: clampDetailHeight(current.height ?? defaultDetailHeight, layout),
        }));
      },
      onPanResponderMove: (_event, gesture) => {
        setDrag((current) => ({
          ...current,
          height: heightFromGesture(current.start, gesture.dy),
        }));
      },
      onPanResponderRelease: (_event, gesture) => {
        setDrag((current) => ({
          ...current,
          height: snapDetailHeight(heightFromGesture(current.start, gesture.dy), layout),
        }));
      },
    });
  }, [layout, defaultDetailHeight]);

  const calendarWorkouts = useMemo(
    () => [...completedWorkouts, ...plannedWorkouts, ...(activeWorkout ? [activeWorkout] : [])],
    [completedWorkouts, plannedWorkouts, activeWorkout],
  );
  const marksByDate = useMemo(
    () => buildDayMarks(calendarWorkouts, workoutExercises, exerciseById),
    [calendarWorkouts, workoutExercises, exerciseById],
  );

  const dayWorkouts = completedWorkouts.filter((workout) => workout.performedAt === selectedDate);
  const dayPlannedWorkouts = plannedWorkouts.filter(
    (workout) => workout.performedAt === selectedDate,
  );
  const dayItems = workoutExercises
    .filter((item) => dayWorkouts.some((workout) => workout.id === item.workoutId))
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const daySets = visibleSets.filter((set) =>
    dayItems.some((item) => item.id === set.workoutExerciseId),
  );
  const daySummary = summarizeSets(daySets);
  const isResumable = activeWorkout !== null && activeWorkout.performedAt === selectedDate;

  return (
    <View
      style={styles.homeLayout}
      onLayout={(event) => setLayout(withMeasured('container', event.nativeEvent.layout.height))}
    >
      <View style={styles.homeCalendarPane}>
        <View
          style={styles.section}
          onLayout={(event) => setLayout(withMeasured('calendar', event.nativeEvent.layout.height))}
        >
          <MonthCalendar
            marksByDate={marksByDate}
            selectedDate={selectedDate}
            today={today}
            onSelectDate={setSelectedDate}
            onWeekRowHeight={(height) => setLayout(withMeasured('weekRow', height))}
          />
        </View>
      </View>

      <View
        style={styles.dragHandle}
        accessibilityRole="adjustable"
        accessibilityLabel="カレンダーと記録の表示比率を変える"
        {...panResponder.panHandlers}
      >
        <View style={styles.dragHandleBar} />
      </View>

      <View style={[styles.section, { height: resolvedDetailHeight }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>
            {formatJapaneseDate(selectedDate)}
            {selectedDate === today ? '（今日）' : ''}
          </Text>
          {dayWorkouts[0] ? (
            <Pressable
              style={styles.ghostButton}
              onPress={() => onEditWorkout(dayWorkouts[0]?.id ?? '')}
            >
              <Text style={styles.ghostButtonText}>編集</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.homeDetailScroll}>
          {dayItems.length > 0 ? (
            <>
              <StatSummary
                primary={{
                  label: '総ボリューム',
                  value: formatCount(daySummary.totalVolume),
                  unit: 'kg',
                }}
                items={[
                  { label: '種目', value: formatCount(dayItems.length) },
                  { label: 'セット', value: formatCount(daySummary.setCount) },
                  { label: 'レップ', value: formatCount(daySummary.totalReps) },
                ]}
              />
              {dayItems.map((item) => {
                const exercise = exerciseById.get(item.exerciseId);
                const itemSets = visibleSets
                  .filter((set) => set.workoutExerciseId === item.id)
                  .sort((a, b) => a.orderIndex - b.orderIndex);
                return (
                  <Pressable
                    key={item.id}
                    style={styles.exerciseRow}
                    onPress={() => onSelectExercise(item.exerciseId)}
                  >
                    <View style={styles.exerciseRowHeader}>
                      <View
                        style={[
                          styles.exerciseDot,
                          { backgroundColor: bodyPartColor(exercise?.primaryBodyPartId) },
                        ]}
                      />
                      <Text style={styles.exerciseRowName}>{exercise?.name ?? '種目'}</Text>
                      <Text style={styles.faint}>{itemSets.length} セット</Text>
                      <Text style={styles.chevron}>›</Text>
                    </View>
                    {itemSets.length > 0 ? (
                      <View style={styles.sectionBody}>
                        <Text style={styles.muted}>{formatSetsInline(itemSets)}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </>
          ) : (
            <View style={styles.sectionBody}>
              <Text style={styles.muted}>
                {selectedDate === today
                  ? 'この日の記録はまだありません。右下の＋から記録を始めましょう。'
                  : 'この日の記録はありません。カレンダーで別の日を選ぶと、その日の内容を見られます。'}
              </Text>
            </View>
          )}

          <PlannedWorkoutSection
            plannedWorkouts={dayPlannedWorkouts}
            workoutExercises={workoutExercises}
            visibleSets={visibleSets}
            exerciseById={exerciseById}
            hasActiveWorkout={activeWorkout !== null}
            onBegin={onBeginPlanned}
          />

          {isResumable ? (
            <View style={styles.sectionBody}>
              <Text style={styles.accentNote}>記録途中のワークアウトがあります。</Text>
              <Pressable style={styles.primaryButton} onPress={onResume}>
                <Text style={styles.primaryButtonText}>途中の記録を再開</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}
