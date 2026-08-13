export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MS_PER_DAY = 86_400_000;

// ISO 日付どうしの日数差。時刻を持たない文字列から作るのでタイムゾーンの影響を受けない。
export const daysBetween = (fromIsoDate: string, toIsoDate: string): number =>
  Math.round(
    (Date.parse(`${toIsoDate}T00:00:00Z`) - Date.parse(`${fromIsoDate}T00:00:00Z`)) / MS_PER_DAY,
  );

export const nowIso = (): string => new Date().toISOString();

/** 現在時刻のエポックミリ秒。タイマーの終了時刻の計算に使う。 */
export const nowMs = (): number => Date.now();

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

// 「14:32」表記。記録中ワークアウトの最終保存時刻に使う。
const formatClockTime = (isoDateTime: string): string => {
  const date = new Date(isoDateTime);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 「5/27 14:32」表記。クラウドバックアップの最終実行日時に使う。
export const formatDateTime = (isoDateTime: string): string => {
  const date = new Date(isoDateTime);
  return `${date.getMonth() + 1}/${date.getDate()} ${formatClockTime(isoDateTime)}`;
};

// n か月前の同日（YYYY-MM-DD）。種目詳細の期間切り替えの起点に使う。
export const isoDateMonthsAgo = (months: number, from: Date): string => {
  const date = new Date(from.getFullYear(), from.getMonth() - months, from.getDate());
  return formatDate(date);
};

// 端末ローカル日付を日数分ずらす（YYYY-MM-DD）。予定の取得期間の算出に使う。
export const isoDatePlusDays = (isoDate: string, days: number): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return formatDate(new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
};

// 月曜はじまりで「今週」の開始日（YYYY-MM-DD）を返す。ホームの週間統計に使う。
export const startOfWeekIso = (date: Date): string => {
  const dayOfWeek = date.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
  return formatDate(monday);
};

// ISO 日付が属する週（月曜はじまり）の開始日。履歴の推移グラフを週単位でまとめるのに使う。
export const startOfWeekIsoDate = (isoDate: string): string => startOfWeekIso(parseIsoDate(isoDate));

/**
 * 期間の起点（この日以降を対象にする）。`months` が 0 なら今週の月曜、null なら制限なし。
 *
 * 履歴タブと CSV 出力で別々に書いていたため、「今週」の定義を変えると
 * 画面ごとに範囲が食い違う状態だった。ここを唯一の定義にする。
 */
export const periodStartIso = (months: number | null, from = new Date()): string | null => {
  if (months === null) {
    return null;
  }
  return months === 0 ? startOfWeekIso(from) : isoDateMonthsAgo(months, from);
};
