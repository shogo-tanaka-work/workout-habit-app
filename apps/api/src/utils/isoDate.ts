// ISO 日付（YYYY-MM-DD）の計算。**この形式は辞書順が日付順と一致する**ため、
// 比較と保存は文字列のまま行い、Date を作るのは計算のときだけにする。
//
// **モバイル側 apps/mobile/src/utils/datetime.ts と同じ定義を保つ。**
// 週の起点（月曜はじまり）が食い違うと、アプリが出す「今週」とサーバが出す
// 「今週」がずれる。片方だけ変えない。

export const DAYS_PER_WEEK = 7;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const formatIsoDate = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * `YYYY-MM-DD` をローカル日付として解釈する。
 * **`new Date('YYYY-MM-DD')` は使わない**（UTC 解釈になり、日本時間では前日になる）。
 *
 * 形式が不正なら `Invalid Date` を返す。呼び出し側が ISO_DATE_PATTERN で
 * 検証済みであることを前提にしている（ここでフォールバックを持つと、
 * 検証漏れが「1970年の集計」として静かに紛れ込む）。
 */
export const parseIsoDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// 月曜はじまりの週開始日（モバイル側 startOfWeekIso と同じ定義）。
export const weekStartIso = (isoDate: string): string => {
  const date = parseIsoDate(isoDate);
  const daysSinceMonday = (date.getDay() + 6) % DAYS_PER_WEEK;
  date.setDate(date.getDate() - daysSinceMonday);
  return formatIsoDate(date);
};

/**
 * 日付を日数分ずらす。負数を渡せば先へ進む。
 *
 * **ms 加算（`+ days * 86_400_000`）では書かない。** 夏時間のある地域で
 * 遷移日をまたぐとローカル日付が1日ずれる。
 */
export const shiftIsoDate = (isoDate: string, days: number): string => {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
};

export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

export const firstDayOfMonthsAgo = (today: string, monthsAgo: number): string => {
  const date = parseIsoDate(today);
  return formatIsoDate(new Date(date.getFullYear(), date.getMonth() - monthsAgo, 1));
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 日付どうしの日数差。**時刻を持たない文字列を UTC として解釈する**ので、
 * 実行環境のタイムゾーンや夏時間の影響を受けない。
 */
export const daysBetweenIso = (from: string, to: string): number =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MILLISECONDS_PER_DAY;
