export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const nowIso = (): string => new Date().toISOString();

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

// performed_at（YYYY-MM-DD）をローカル日付として解釈する。
// `new Date('YYYY-MM-DD')` は UTC 解釈で曜日がずれるため使わない。
const parseIsoDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
};

// 「5月27日(水)」表記。履歴・種目詳細の日付見出しに使う。
export const formatJapaneseDate = (isoDate: string): string => {
  const date = parseIsoDate(isoDate);
  return `${date.getMonth() + 1}月${date.getDate()}日(${WEEKDAY_LABELS[date.getDay()]})`;
};

// 「5/27」表記。グラフのX軸ラベルや前回実績の添え書きに使う。
export const formatMonthDay = (isoDate: string): string => {
  const date = parseIsoDate(isoDate);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// 月曜はじまりで「今週」の開始日（YYYY-MM-DD）を返す。ホームの週間統計に使う。
export const startOfWeekIso = (date: Date): string => {
  const dayOfWeek = date.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
  return formatDate(monday);
};
