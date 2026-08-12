import { formatDate } from './datetime';

// 月間カレンダー（ホーム）用の純粋関数群。週は参考UIに合わせて月曜はじまり。

export type YearMonth = {
  year: number;
  // 1〜12。Date の 0 始まりと混同しないようドメイン側は 1 始まりで持つ。
  month: number;
};

export const currentYearMonth = (today: Date): YearMonth => ({
  year: today.getFullYear(),
  month: today.getMonth() + 1,
});

const ISO_YEAR_END = 4;
const ISO_MONTH_START = 5;
const ISO_MONTH_END = 7;

// ISO 日付（YYYY-MM-DD）が属する年月。文字列から切り出すのでタイムゾーンの影響を受けない。
export const yearMonthOf = (isoDate: string): YearMonth => ({
  year: Number(isoDate.slice(0, ISO_YEAR_END)),
  month: Number(isoDate.slice(ISO_MONTH_START, ISO_MONTH_END)),
});

export const shiftMonth = ({ year, month }: YearMonth, delta: number): YearMonth => {
  const shifted = new Date(year, month - 1 + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
};

export const formatYearMonth = ({ year, month }: YearMonth): string => `${year}年${month}月`;

const ISO_DAY_START = 8;
const ISO_DAY_END = 10;

export const dayOfMonth = (isoDate: string): number =>
  Number(isoDate.slice(ISO_DAY_START, ISO_DAY_END));

const DAYS_PER_WEEK = 7;

// 月曜はじまりの週ごとの ISO 日付配列。月外のセルは null。
export const buildMonthWeeks = ({ year, month }: YearMonth): (string | null)[][] => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const mondayBasedFirstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % DAYS_PER_WEEK;

  const cells: (string | null)[] = Array.from({ length: mondayBasedFirstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(formatDate(new Date(year, month - 1, day)));
  }
  while (cells.length % DAYS_PER_WEEK !== 0) {
    cells.push(null);
  }

  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += DAYS_PER_WEEK) {
    weeks.push(cells.slice(index, index + DAYS_PER_WEEK));
  }
  return weeks;
};
