import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { styles } from '../styles/appStyles';
import {
  WEEKDAY_HEADER,
  buildMonthWeeks,
  dayOfMonth,
  formatYearMonth,
  shiftMonth,
  weekdayKindOf,
  yearMonthOf,
} from '../utils/calendar';
import { formatDate } from '../utils/datetime';

// 日付を選んでカレンダーを飛ばすためのシート（画面下から出す）。
// 月送りボタンを何度も押さずに、離れた日付へ一度で移動できるようにする。
// 年送りも置いて、去年の記録まで数タップで届くようにしてある。
export function DatePickerModal({
  value,
  onConfirm,
  onCancel,
}: {
  /** 初期選択日（ISO の YYYY-MM-DD）。 */
  value: string;
  onConfirm: (isoDate: string) => void;
  onCancel: () => void;
}) {
  const [yearMonth, setYearMonth] = useState(() => yearMonthOf(value));
  const [selected, setSelected] = useState(value);
  const weeks = buildMonthWeeks(yearMonth);
  const today = formatDate(new Date());

  // 色の対応。スタイル自体は appStyles で共有しているので、色を変えるならそちらを直す。
  const weekendTextStyle = (weekdayIndex: number) => {
    const kind = weekdayKindOf(weekdayIndex);
    if (kind === 'saturday') {
      return styles.calendarSaturdayText;
    }
    if (kind === 'sunday') {
      return styles.calendarSundayText;
    }
    return null;
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => undefined}>
          <Text style={styles.sectionTitle}>日付を選ぶ</Text>

          <View style={styles.rowBetween}>
            <View style={styles.inlineRow}>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setYearMonth(shiftMonth(yearMonth, -12))}
                accessibilityRole="button"
                accessibilityLabel="前の年"
              >
                <Text style={styles.calendarNavText}>«</Text>
              </Pressable>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setYearMonth(shiftMonth(yearMonth, -1))}
                accessibilityRole="button"
                accessibilityLabel="前の月"
              >
                <Text style={styles.calendarNavText}>‹</Text>
              </Pressable>
            </View>
            <Text style={styles.calendarTitle}>{formatYearMonth(yearMonth)}</Text>
            <View style={styles.inlineRow}>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setYearMonth(shiftMonth(yearMonth, 1))}
                accessibilityRole="button"
                accessibilityLabel="次の月"
              >
                <Text style={styles.calendarNavText}>›</Text>
              </Pressable>
              <Pressable
                style={styles.calendarNavButton}
                onPress={() => setYearMonth(shiftMonth(yearMonth, 12))}
                accessibilityRole="button"
                accessibilityLabel="次の年"
              >
                <Text style={styles.calendarNavText}>»</Text>
              </Pressable>
            </View>
          </View>

          <View>
            <View style={styles.datePickerWeekRow}>
              {WEEKDAY_HEADER.map((label, weekdayIndex) => (
                <Text
                  key={label}
                  style={[styles.calendarWeekdayText, weekendTextStyle(weekdayIndex)]}
                >
                  {label}
                </Text>
              ))}
            </View>
            {weeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={styles.datePickerWeekRow}>
                {week.map((isoDate, weekdayIndex) => {
                  if (!isoDate) {
                    return (
                      <View
                        key={`empty-${weekIndex}-${weekdayIndex}`}
                        style={styles.datePickerDayCell}
                      />
                    );
                  }
                  const isSelected = selected === isoDate;
                  return (
                    <Pressable
                      key={isoDate}
                      style={[
                        styles.datePickerDayCell,
                        isSelected && styles.datePickerDayCellSelected,
                      ]}
                      onPress={() => setSelected(isoDate)}
                    >
                      <Text
                        style={[
                          styles.calendarDayText,
                          weekendTextStyle(weekdayIndex),
                          today === isoDate && styles.calendarTodayText,
                          isSelected && styles.datePickerDayTextSelected,
                        ]}
                      >
                        {dayOfMonth(isoDate)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          <View style={styles.modalActions}>
            <Pressable
              style={styles.ghostButton}
              onPress={() => {
                setSelected(today);
                setYearMonth(yearMonthOf(today));
              }}
            >
              <Text style={styles.ghostButtonText}>今日</Text>
            </Pressable>
            <Pressable style={styles.ghostButton} onPress={onCancel}>
              <Text style={styles.ghostButtonText}>キャンセル</Text>
            </Pressable>
            <Pressable style={styles.primaryButtonFlat} onPress={() => onConfirm(selected)}>
              <Text style={styles.primaryButtonText}>決定</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
