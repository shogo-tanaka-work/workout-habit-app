// API アクセスとローカル設定の保存。
//
// 認証は Cloudflare Access が担う。ブラウザはトークンを持たず、
// Access のセッションクッキーがそのままリクエストへ乗る。
//
// API はこの画面と**同一オリジンの /api/* 配下**にある。
// 実体は別の Worker（workout-habit-api）で、配信元の Worker が中継している（worker/index.ts）。
// 同一オリジンなので CORS も不要。

/** 中継先の接頭辞。worker/index.ts の API_PREFIX と対になる。 */
const API_PREFIX = '/api';

const WEEKLY_GOAL_STORAGE_KEY = 'workout-habit-web/weekly-goal';
const DEFAULT_WEEKLY_GOAL = 3;

export const loadWeeklyGoal = (): number => {
  const stored = Number(localStorage.getItem(WEEKLY_GOAL_STORAGE_KEY));
  return Number.isInteger(stored) && stored > 0 ? stored : DEFAULT_WEEKLY_GOAL;
};

export const saveWeeklyGoal = (weeklyGoal: number): void => {
  localStorage.setItem(WEEKLY_GOAL_STORAGE_KEY, String(weeklyGoal));
};

/** 認証は通ったが、D1 の users に登録が無い（または停止中）。 */
export class ForbiddenError extends Error {
  constructor() {
    super('このアカウントは管理画面の利用を許可されていません。');
    this.name = 'ForbiddenError';
  }
}

/** Access のセッションが切れた。ページを開き直せばログインし直せる。 */
export class UnauthorizedError extends Error {
  constructor() {
    super('ログインの有効期限が切れました。ページを再読み込みしてください。');
    this.name = 'UnauthorizedError';
  }
}

// /analytics 配下の GET。レスポンス型の保証は呼び出し側の型引数（API と同repoの型定義）に委ねる。
export const apiGet = async <Response>(path: string): Promise<Response> => {
  const response = await fetch(`${API_PREFIX}${path}`);
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (response.status === 403) {
    throw new ForbiddenError();
  }
  if (!response.ok) {
    throw new Error(`データ取得に失敗しました（HTTP ${response.status}）`);
  }
  return (await response.json()) as Response;
};
