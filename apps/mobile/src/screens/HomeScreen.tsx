import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';

import { BodyLogInput } from '../components/BodyLogInput';
import { GymCostSection } from '../components/GymCostSection';
import { MonthCalendar } from '../components/MonthCalendar';
import { PlannedWorkoutSection } from '../components/PlannedWorkoutSection';
import { StatSummary } from '../components/StatSummary';
import { styles } from '../styles/appStyles';
import { bodyPartColor } from '../styles/theme';
import type { BodyLog, Exercise, Workout, WorkoutExercise, WorkoutSet } from '../types/domain';
import { formatSetsInline, summarizeSets } from '../utils/aggregate';
import { buildDayMarks } from '../utils/calendarMarks';
import { formatDate, formatJapaneseDate } from '../utils/datetime';
import { countVisitDays, summarizeGymCost, yearMonthOfDate } from '../utils/gymCost';
import { formatCount } from '../utils/number';
import { exerciseNameOf } from '../utils/workoutTree';

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
  bodyLogs,
  gymMonthlyFeeYen,
  onResume,
  onBeginPlanned,
  onEditWorkout,
  onAddPastWorkout,
  onSelectExercise,
  onSaveBodyLog,
}: {
  activeWorkout: Workout | null;
  completedWorkouts: Workout[];
  plannedWorkouts: Workout[];
  workoutExercises: WorkoutExercise[];
  visibleSets: WorkoutSet[];
  exerciseById: Map<string, Exercise>;
  /** ボディログ（measuredAt 降順）。 */
  bodyLogs: BodyLog[];
  /** ジムの月額料金（円）。未設定（null）ならジム代の区画を出さない。 */
  gymMonthlyFeeYen: number | null;
  onResume: () => void;
  onBeginPlanned: (workoutId: string) => void;
  onEditWorkout: (workoutId: string) => void;
  /** 過去日の記録を作って編集画面を開く（記録が無い過去日でだけ呼ばれる）。 */
  onAddPastWorkout: (performedAt: string) => void;
  onSelectExercise: (exerciseId: string) => void;
  onSaveBodyLog: (
    measuredAt: string,
    bodyWeightKg: number,
    bodyFatPercentage: number | null,
  ) => void;
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

  // memo した MonthCalendar へ渡すため、参照を安定させる（インラインだと毎レンダー新参照）。
  const handleWeekRowHeight = useCallback(
    (height: number) => setLayout(withMeasured('weekRow', height)),
    [],
  );

  const calendarWorkouts = useMemo(
    () => [...completedWorkouts, ...plannedWorkouts, ...(activeWorkout ? [activeWorkout] : [])],
    [completedWorkouts, plannedWorkouts, activeWorkout],
  );
  const marksByDate = useMemo(
    () => buildDayMarks(calendarWorkouts, workoutExercises, exerciseById),
    [calendarWorkouts, workoutExercises, exerciseById],
  );

  // 記録中（active）もその日の記録として扱う。完了させないと日詳細に出ず、
  // 編集も削除もできなかった。予定（planned）は別概念なので入れない
  // （下の PlannedWorkoutSection が受け持つ）。
  const isOnSelectedDate = (workout: Workout) => workout.performedAt === selectedDate;
  const dayActiveWorkouts = activeWorkout && isOnSelectedDate(activeWorkout) ? [activeWorkout] : [];
  const dayWorkouts = [...completedWorkouts.filter(isOnSelectedDate), ...dayActiveWorkouts];
  const dayPlannedWorkouts = plannedWorkouts.filter(isOnSelectedDate);
  const dayItems = workoutExercises
    .filter((item) => dayWorkouts.some((workout) => workout.id === item.workoutId))
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const daySets = visibleSets.filter((set) =>
    dayItems.some((item) => item.id === set.workoutExerciseId),
  );
  const daySummary = summarizeSets(daySets);
  // ジム代は日ではなく月の話。選んでいる日の月で出す（先月を選べば先月の単価が見られる）。
  const selectedYearMonth = yearMonthOfDate(selectedDate);
  const gymCost = summarizeGymCost(
    gymMonthlyFeeYen ?? 0,
    countVisitDays(calendarWorkouts, selectedYearMonth),
  );
  const isResumable = dayActiveWorkouts.length > 0;
  // 未来の実績は作れない（未来日の予定は Claude Code 連携が受け持つ）。
  const isPastDate = selectedDate < today;

  // 種目が1つも無いときの案内。記録そのものの有無と日付で、次にとる行動が変わる。
  const emptyDetailMessage = (): string => {
    if (dayWorkouts.length > 0) {
      return 'この記録にはまだ種目が入っていません。「編集」から種目とセットを足せます。';
    }
    if (selectedDate === today) {
      return 'この日の記録はまだありません。右下の＋から記録を始めましょう。';
    }
    if (isPastDate) {
      return 'この日の記録はありません。あとから入れ直すこともできます。';
    }
    return 'この日の記録はありません。カレンダーで別の日を選ぶと、その日の内容を見られます。';
  };

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
            onWeekRowHeight={handleWeekRowHeight}
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
          {/* 同じ日に完了済みと記録中が並ぶことがあるので、記録ごとに導線を出す。
              ラベルで「どちらを直すか」を分かるようにする。 */}
          <View style={styles.headerActions}>
            {dayWorkouts.map((workout) => (
              <Pressable
                key={workout.id}
                style={styles.ghostButton}
                onPress={() => onEditWorkout(workout.id)}
              >
                <Text style={styles.ghostButtonText}>
                  {workout.status === 'active' ? '記録中を編集' : '編集'}
                </Text>
              </Pressable>
            ))}
          </View>
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
                      <Text style={styles.exerciseRowName}>
                        {exerciseNameOf(item.exerciseId, exerciseById)}
                      </Text>
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
              <Text style={styles.muted}>{emptyDetailMessage()}</Text>
              {isPastDate && dayWorkouts.length === 0 ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => onAddPastWorkout(selectedDate)}
                >
                  <Text style={styles.secondaryButtonText}>この日の記録を追加</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* 日を切り替えたら入力もその日の値に差し替わるよう、key に日付を渡す。 */}
          <BodyLogInput
            key={selectedDate}
            date={selectedDate}
            log={bodyLogs.find((log) => log.measuredAt === selectedDate) ?? null}
            latestLog={bodyLogs[0] ?? null}
            onSave={onSaveBodyLog}
          />

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

          {/* **画面の高さを取らない位置に置く。** 月の話は毎回見るものではないので、
              その日の記録・予定・再開の導線をすべて済ませたあと、スクロールの先に置く。 */}
          {gymMonthlyFeeYen === null ? null : (
            <GymCostSection
              monthlyFeeYen={gymMonthlyFeeYen}
              cost={gymCost}
              monthLabel={`${Number(selectedYearMonth.slice(5, 7))}月`}
            />
          )}
        </ScrollView>
      </View>
    </View>
  );
}
