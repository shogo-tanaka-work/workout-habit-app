import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DatePickerModal } from './DatePickerModal';
import { styles } from '../styles/appStyles';
import {
  buildMonthWeeks,
  currentYearMonth,
  dayOfMonth,
  formatYearMonth,
  shiftMonth,
  yearMonthOf,
} from '../utils/calendar';
import type { DayMarks } from '../utils/calendarMarks';

const WEEKDAY_HEADER = ['月', '火', '水', '木', '金', '土', '日'] as const;
const SATURDAY_INDEX = 5;
const SUNDAY_INDEX = 6;
// セル幅に収まる数。超えた分は「+n」でまとめる。
const MAX_VISIBLE_MARKS = 3;

// ホームの主役になる月間カレンダー（月曜はじまり）。
// 日セルには「部位色 × 種目数」のマークを出し、その月の実績が一望できるようにする。
// タップでその日を選び、下の詳細セクションが連動する。
export function MonthCalendar({
  marksByDate,
  selectedDate,
  today,
  onSelectDate,
  onWeekRowHeight,
}: {
  marksByDate: Map<string, DayMarks>;
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
  /** 週1行の高さ。ホームで高さを週単位にスナップさせるために測る。 */
  onWeekRowHeight?: (height: number) => void;
}) {
  const [yearMonth, setYearMonth] = useState(() => currentYearMonth(new Date()));
  const [isDatePickerOpen, setDatePickerOpen] = useState(false);
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

  const goToToday = () => {
    setYearMonth(yearMonthOf(today));
    onSelectDate(today);
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
        <Pressable
          style={styles.calendarTitleButton}
          onPress={() => setDatePickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="日付を選んで移動する"
        >
          <Text style={styles.calendarTitle}>{formatYearMonth(yearMonth)}</Text>
          <Text style={styles.calendarTitleCaret}>▾</Text>
        </Pressable>
        <View style={styles.calendarHeaderRight}>
          <Pressable style={styles.ghostButton} onPress={goToToday}>
            <Text style={styles.ghostButtonText}>今日</Text>
          </Pressable>
          <Pressable
            style={styles.calendarNavButton}
            onPress={() => setYearMonth(shiftMonth(yearMonth, 1))}
          >
            <Text style={styles.calendarNavText}>›</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.calendarWeekdayRow}>
        {WEEKDAY_HEADER.map((label, weekdayIndex) => (
          <Text key={label} style={[styles.calendarWeekdayText, weekendTextStyle(weekdayIndex)]}>
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View
          key={`week-${weekIndex}`}
          style={styles.calendarWeekRow}
          onLayout={
            weekIndex === 0 && onWeekRowHeight
              ? (event) => onWeekRowHeight(event.nativeEvent.layout.height)
              : undefined
          }
        >
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
            const dayMarks = marksByDate.get(isoDate);
            const marks = dayMarks?.marks ?? [];
            const visibleMarks = marks.slice(0, MAX_VISIBLE_MARKS);
            const hiddenCount = marks.length - visibleMarks.length;
            const isSelected = selectedDate === isoDate;
            const isToday = today === isoDate;
            return (
              <Pressable
                key={isoDate}
                style={[
                  styles.calendarDayCell,
                  isLastColumn && styles.calendarDayCellLast,
                  isSelected && styles.calendarDaySelected,
                ]}
                onPress={() => onSelectDate(isoDate)}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    weekendTextStyle(weekdayIndex),
                    isToday && styles.calendarTodayText,
                  ]}
                >
                  {dayOfMonth(isoDate)}
                </Text>
                <View style={styles.calendarMarkRow}>
                  {visibleMarks.map((mark) => (
                    <View
                      key={mark.bodyPartId}
                      style={[
                        styles.calendarMark,
                        dayMarks?.isPlannedOnly
                          ? { borderColor: mark.color }
                          : { backgroundColor: mark.color },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarMarkText,
                          dayMarks?.isPlannedOnly && { color: mark.color },
                        ]}
                      >
                        {mark.count}
                      </Text>
                    </View>
                  ))}
                  {hiddenCount > 0 ? (
                    <Text style={styles.calendarMarkOverflow}>+{hiddenCount}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      {isDatePickerOpen ? (
        <DatePickerModal
          value={selectedDate}
          onConfirm={(isoDate) => {
            setDatePickerOpen(false);
            setYearMonth(yearMonthOf(isoDate));
            onSelectDate(isoDate);
          }}
          onCancel={() => setDatePickerOpen(false)}
        />
      ) : null}
    </View>
  );
}
