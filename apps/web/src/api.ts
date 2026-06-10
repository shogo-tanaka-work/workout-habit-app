import type { BackupPayload } from './types/db';

// API アクセスとトークン保存。配信元の Worker（workout-habit-api）と同一オリジン前提。

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

export const fetchBackup = async (token: string): Promise<BackupPayload> => {
  const response = await fetch('/backup', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(`データ取得に失敗しました（HTTP ${response.status}）`);
  }
  const payload: unknown = await response.json();
  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as { tables?: unknown }).tables !== 'object'
  ) {
    throw new Error('データ取得に失敗しました（想定外のレスポンス形式）');
  }
  return payload as BackupPayload;
};
