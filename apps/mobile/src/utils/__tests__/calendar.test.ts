import {
  buildMonthWeeks,
  currentYearMonth,
  dayOfMonth,
  formatYearMonth,
  shiftMonth,
  WEEKDAY_HEADER,
  weekdayKindOf,
  yearMonthOf,
} from '../calendar';

describe('WEEKDAY_HEADER / weekdayKindOf', () => {
  it('月曜はじまりで並ぶ', () => {
    expect(WEEKDAY_HEADER[0]).toBe('月');
    expect(WEEKDAY_HEADER).toHaveLength(7);
  });

  it('色を分けるのは土日だけ', () => {
    expect(weekdayKindOf(0)).toBe('weekday');
    expect(weekdayKindOf(5)).toBe('saturday');
    expect(weekdayKindOf(6)).toBe('sunday');
  });
});

describe('currentYearMonth / yearMonthOf', () => {
  it('Date からは 1 始まりの月で取り出す', () => {
    expect(currentYearMonth(new Date(2026, 7, 27))).toEqual({ year: 2026, month: 8 });
  });

  it('ISO 日付は文字列から切り出す（タイムゾーンの影響を受けない）', () => {
    expect(yearMonthOf('2026-01-01')).toEqual({ year: 2026, month: 1 });
  });
});

describe('shiftMonth', () => {
  it('年をまたいで戻る', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('年をまたいで進む', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });
});

describe('formatYearMonth / dayOfMonth', () => {
  it('見出しと日を取り出す', () => {
    expect(formatYearMonth({ year: 2026, month: 8 })).toBe('2026年8月');
    expect(dayOfMonth('2026-08-05')).toBe(5);
  });
});

describe('buildMonthWeeks', () => {
  it('月頭までの空きを null で埋める（2026-08-01 は土曜）', () => {
    const weeks = buildMonthWeeks({ year: 2026, month: 8 });
    expect(weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(weeks[0][5]).toBe('2026-08-01');
  });

  it('全セルが7の倍数になる', () => {
    const weeks = buildMonthWeeks({ year: 2026, month: 8 });
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('その月の日数ぶんだけ日付セルを持つ', () => {
    const weeks = buildMonthWeeks({ year: 2026, month: 2 });
    const days = weeks.flat().filter((cell): cell is string => cell !== null);
    expect(days).toHaveLength(28);
    expect(days.at(-1)).toBe('2026-02-28');
  });

  it('うるう年の2月は29日まで並ぶ', () => {
    const days = buildMonthWeeks({ year: 2028, month: 2 })
      .flat()
      .filter((cell): cell is string => cell !== null);
    expect(days.at(-1)).toBe('2028-02-29');
  });
});
