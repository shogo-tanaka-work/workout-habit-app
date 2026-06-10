// 日付処理の純粋関数。dateKey は YYYY-MM-DD 形式のローカル日付文字列。

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
// getDay() は日曜=0。週の起点を月曜にするためのオフセット。
const MONDAY_INDEX = 1;

export const toDateKey = (isoString: string): string => isoString.slice(0, 10);

export const parseDateKey = (dateKey: string): Date => new Date(`${dateKey}T00:00:00`);

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

// その日が属する週の月曜日。
export const mondayOf = (date: Date): Date => {
  const offset = (date.getDay() - MONDAY_INDEX + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(parseDateKey(formatDateKey(date)), -offset);
};

// dateKey が属する週のキー（月曜の dateKey）。
export const weekKeyOf = (dateKey: string): string => formatDateKey(mondayOf(parseDateKey(dateKey)));

export const monthKeyOf = (dateKey: string): string => dateKey.slice(0, 7);

// 今週を末尾に、過去 count 週分の weekKey を昇順で返す。
export const listRecentWeekKeys = (count: number, today = new Date()): string[] => {
  const currentMonday = mondayOf(today);
  const weekKeys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    weekKeys.push(formatDateKey(addDays(currentMonday, -i * DAYS_PER_WEEK)));
  }
  return weekKeys;
};

// 今月を末尾に、過去 count か月分の monthKey（YYYY-MM）を昇順で返す。
export const listRecentMonthKeys = (count: number, today = new Date()): string[] => {
  const monthKeys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    monthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return monthKeys;
};

// "6/9" のような短い表記（週ラベル・グラフ軸用）。
export const formatShortDate = (dateKey: string): string => {
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  return `${month}/${day}`;
};

// "2026年6月" / monthKey 用。
export const formatMonth = (monthKey: string): string => {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  return `${year}年${month}月`;
};

// 今日から days 日前の dateKey。
export const dateKeyDaysAgo = (days: number, today = new Date()): string =>
  formatDateKey(addDays(parseDateKey(formatDateKey(today)), -days));
