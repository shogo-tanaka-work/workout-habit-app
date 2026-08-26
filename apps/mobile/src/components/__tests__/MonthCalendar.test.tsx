import { fireEvent, render, screen } from '@testing-library/react-native';

import type { DayMarks } from '../../utils/calendarMarks';
import { formatDate } from '../../utils/datetime';
import { MonthCalendar } from '../MonthCalendar';

// カレンダーは起動時に「今日の月」を開く。実行日に左右されないよう、
// テストデータも実行時の今日から組み立てる。
const today = formatDate(new Date());
const todayDayOfMonth = String(Number(today.slice(8, 10)));

const fourMarks: DayMarks = {
  marks: [
    { bodyPartId: 'chest', color: '#f00', count: 2 },
    { bodyPartId: 'back', color: '#0f0', count: 1 },
    { bodyPartId: 'legs', color: '#00f', count: 1 },
    { bodyPartId: 'arms', color: '#ff0', count: 1 },
  ],
  isPlannedOnly: false,
};

const renderCalendar = (overrides: Partial<React.ComponentProps<typeof MonthCalendar>> = {}) =>
  render(
    <MonthCalendar
      marksByDate={new Map()}
      selectedDate={today}
      today={today}
      onSelectDate={jest.fn()}
      {...overrides}
    />,
  );

describe('MonthCalendar', () => {
  it('月曜はじまりの曜日見出しを出す', () => {
    renderCalendar();
    expect(screen.getByText('月')).toBeTruthy();
    expect(screen.getByText('日')).toBeTruthy();
  });

  it('前後の月へ動ける', () => {
    renderCalendar();
    const initialTitle = screen.getByText(/年\d+月$/).props.children as string;

    fireEvent.press(screen.getByText('‹'));
    expect(screen.queryByText(initialTitle)).toBeNull();

    fireEvent.press(screen.getByText('›'));
    expect(screen.getByText(initialTitle)).toBeTruthy();
  });

  it('日をタップすると選び直す', () => {
    const onSelectDate = jest.fn();
    renderCalendar({ onSelectDate });

    fireEvent.press(screen.getByText(todayDayOfMonth));

    expect(onSelectDate).toHaveBeenCalledWith(today);
  });

  it('「今日」で今日へ戻る', () => {
    const onSelectDate = jest.fn();
    renderCalendar({ onSelectDate, selectedDate: '2020-01-01' });

    fireEvent.press(screen.getByText('今日'));

    expect(onSelectDate).toHaveBeenCalledWith(today);
  });

  it('マークは3件までで、超えたぶんは +n でまとめる', () => {
    renderCalendar({ marksByDate: new Map([[today, fourMarks]]) });
    expect(screen.getByText('+1')).toBeTruthy();
  });

  it('日付を選ぶダイアログを開ける', () => {
    renderCalendar();

    fireEvent.press(screen.getByLabelText('日付を選んで移動する'));

    expect(screen.getByText('日付を選ぶ')).toBeTruthy();
  });
});
