// API アクセスとローカル設定の保存。
// この画面は workout-habit-admin Worker が配信し、API は別オリジンの
// workout-habit-api Worker にある。接続先は VITE_API_ORIGIN で与える。

// 末尾スラッシュはパス結合時に二重になるため落とす。
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN ?? '').replace(/\/+$/, '');

/** API の接続先が設定されているか。未設定なら画面側で設定漏れを知らせる。 */
export const hasApiOrigin = (): boolean => API_ORIGIN.length > 0;

const TOKEN_STORAGE_KEY = 'workout-habit-web/api-token';
const WEEKLY_GOAL_STORAGE_KEY = 'workout-habit-web/weekly-goal';
const DEFAULT_WEEKLY_GOAL = 3;

export const loadToken = (): string => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';

export const saveToken = (token: string): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

export const loadWeeklyGoal = (): number => {
  const stored = Number(localStorage.getItem(WEEKLY_GOAL_STORAGE_KEY));
  return Number.isInteger(stored) && stored > 0 ? stored : DEFAULT_WEEKLY_GOAL;
};

export const saveWeeklyGoal = (weeklyGoal: number): void => {
  localStorage.setItem(WEEKLY_GOAL_STORAGE_KEY, String(weeklyGoal));
};

export class UnauthorizedError extends Error {
  constructor() {
    super('トークンが無効です。再設定してください。');
    this.name = 'UnauthorizedError';
  }
}

// /analytics 配下の GET。レスポンス型の保証は呼び出し側の型引数（API と同repoの型定義）に委ねる。
export const apiGet = async <Response>(path: string, token: string): Promise<Response> => {
  if (!hasApiOrigin()) {
    throw new Error('API の接続先が設定されていません（VITE_API_ORIGIN）。');
  }
  const response = await fetch(`${API_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(`データ取得に失敗しました（HTTP ${response.status}）`);
  }
  return (await response.json()) as Response;
};
