import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import {
  buildMonthWeeks,
  currentYearMonth,
  dayOfMonth,
  formatYearMonth,
  shiftMonth,
} from '../utils/calendar';

const WEEKDAY_HEADER = ['月', '火', '水', '木', '金', '土', '日'] as const;
const SATURDAY_INDEX = 5;
const SUNDAY_INDEX = 6;

// 参考UI準拠の月間カレンダー（月曜はじまり）。記録のある日にアクセント色のドットを出し、
// タップでその日の記録に絞り込む（再タップで解除）。
export function MonthCalendar({
  workoutCountByDate,
  selectedDate,
  onSelectDate,
}: {
  workoutCountByDate: Map<string, number>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}) {
  const [yearMonth, setYearMonth] = useState(() => currentYearMonth(new Date()));
  const weeks = buildMonthWeeks(yearMonth);

  const weekendTextStyle = (weekdayIndex: number) => {
    if (weekdayIndex === SATURDAY_INDEX) {
      return styles.calendarSaturdayText;
    }
    if (weekdayIndex === SUNDAY_INDEX) {
      return styles.calendarSundayText;
    }
    return null;
  };

  return (
    <View>
      <View style={styles.calendarHeader}>
        <Pressable
          style={styles.calendarNavButton}
          onPress={() => setYearMonth(shiftMonth(yearMonth, -1))}
        >
          <Text style={styles.calendarNavText}>‹</Text>
        </Pressable>
        <Text style={styles.calendarTitle}>{formatYearMonth(yearMonth)}</Text>
        <Pressable
          style={styles.calendarNavButton}
          onPress={() => setYearMonth(shiftMonth(yearMonth, 1))}
        >
          <Text style={styles.calendarNavText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.calendarWeekdayRow}>
        {WEEKDAY_HEADER.map((label, weekdayIndex) => (
          <Text key={label} style={[styles.calendarWeekdayText, weekendTextStyle(weekdayIndex)]}>
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.calendarWeekRow}>
          {week.map((isoDate, weekdayIndex) => {
            const isLastColumn = weekdayIndex === week.length - 1;
            if (!isoDate) {
              return (
                <View
                  key={`empty-${weekIndex}-${weekdayIndex}`}
                  style={[styles.calendarDayCell, isLastColumn && styles.calendarDayCellLast]}
                />
              );
            }
            const hasWorkout = (workoutCountByDate.get(isoDate) ?? 0) > 0;
            const isSelected = selectedDate === isoDate;
            return (
              <Pressable
                key={isoDate}
                style={[
                  styles.calendarDayCell,
                  isLastColumn && styles.calendarDayCellLast,
                  isSelected && styles.calendarDaySelected,
                ]}
                onPress={() => {
                  if (hasWorkout) {
                    onSelectDate(isSelected ? null : isoDate);
                  }
                }}
              >
                <Text style={[styles.calendarDayText, weekendTextStyle(weekdayIndex)]}>
                  {dayOfMonth(isoDate)}
                </Text>
                {hasWorkout ? (
                  <View style={styles.calendarDot} />
                ) : (
                  <View style={styles.calendarDotPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
