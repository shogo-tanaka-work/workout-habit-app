// API アクセスとローカル設定の保存。配信元の Worker（workout-habit-api）と同一オリジン前提。

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
  const response = await fetch(path, {
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
