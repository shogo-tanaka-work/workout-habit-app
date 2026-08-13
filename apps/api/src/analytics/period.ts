import {
  DAYS_PER_WEEK,
  firstDayOfMonthsAgo,
  ISO_DATE_PATTERN,
  shiftIsoDate,
  weekStartIso,
} from '../utils/isoDate';

// クエリパラメータから「いつからいつまでを集計するか」を決める。
//
// 各ハンドラが `clampInt` → `resolveToday` → 起点の算出 の3行を書いていたため、
// 既定値や `(weeks - 1)` の解釈を1か所だけ変えると、エンドポイント間で
// 「同じ12週」の範囲がずれる状態だった。解釈はここだけが持つ。

/** 基準日。クライアントが端末ローカル日付を送る（サーバの UTC 今日を暗黙の基準にしない）。 */
const resolveToday = (todayParam: string | undefined): string =>
  todayParam && ISO_DATE_PATTERN.test(todayParam)
    ? todayParam
    : new Date().toISOString().slice(0, 10);

/** 上下限つきの整数変換。無指定の巨大な値で D1 を舐めさせない。 */
const clampInt = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

export type Period = {
  /** 基準日（YYYY-MM-DD）。 */
  today: string;
  /** この日以降を集計する（YYYY-MM-DD）。 */
  since: string;
  /** 要求された期間の長さ。レスポンスの穴埋めに使う。 */
  count: number;
};

/**
 * 週単位の期間。`count` 週ぶんを、**今週を含めて**遡る。
 * 起点は月曜（`weekStartIso`）に丸める。
 */
export const weeklyPeriod = (
  query: { weeks?: string; today?: string },
  fallbackWeeks: number,
  maxWeeks = 53,
): Period => {
  const count = clampInt(query.weeks, fallbackWeeks, 1, maxWeeks);
  const today = resolveToday(query.today);
  return {
    today,
    since: weekStartIso(shiftIsoDate(today, -(count - 1) * DAYS_PER_WEEK)),
    count,
  };
};

/** 月単位の期間。`count` か月ぶんを、**今月を含めて**遡る。起点は月初。 */
export const monthlyPeriod = (
  query: { months?: string; today?: string },
  fallbackMonths: number,
  maxMonths = 36,
): Period => {
  const count = clampInt(query.months, fallbackMonths, 1, maxMonths);
  const today = resolveToday(query.today);
  return { today, since: firstDayOfMonthsAgo(today, count - 1), count };
};
