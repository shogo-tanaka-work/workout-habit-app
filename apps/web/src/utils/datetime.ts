// 日付処理の純粋関数。dateKey は YYYY-MM-DD 形式のローカル日付文字列。
// 集計は /analytics API 側で行うため、ここに残るのは表示整形と
// グラフの空期間穴埋め（記録ゼロの週・月をスロットとして並べる）用のみ。

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
// getDay() は日曜=0。週の起点を月曜にするためのオフセット。
const MONDAY_INDEX = 1;

export const parseDateKey = (dateKey: string): Date => new Date(`${dateKey}T00:00:00`);

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);

// その日が属する週の月曜日（API 側 weekStartIso と同じ定義）。
export const mondayOf = (date: Date): Date => {
  const offset = (date.getDay() - MONDAY_INDEX + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(parseDateKey(formatDateKey(date)), -offset);
};

// 今週を末尾に、過去 count 週分の weekKey（月曜の dateKey）を昇順で返す。
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
