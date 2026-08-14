// 週次 AI フィードバック（weekly_feedback）の読み出し。
// 書き込みは POST /sync/operations が受け持つため、ここは取得だけを持つ。

import type { AuthenticatedUser } from '../auth/types';
import { scopeForUser } from '../db/scope';

export type WeeklyFeedbackEntry = {
  weekStart: string;
  body: string;
  updatedAt: string;
};

/** 期間内の週次フィードバックを、週の新しい順で返す。 */
export const loadWeeklyFeedback = async (
  database: D1Database,
  since: string,
  user: AuthenticatedUser,
): Promise<WeeklyFeedbackEntry[]> => {
  type FeedbackRow = { week_start: string; body: string; updated_at: string };
  const scope = scopeForUser(user, 'user_id');
  const result = await database
    .prepare(
      `SELECT week_start, body, updated_at
       FROM weekly_feedback
       WHERE week_start >= ? AND ${scope.condition}
       ORDER BY week_start DESC`,
    )
    .bind(since, ...scope.params)
    .all<FeedbackRow>();
  return result.results.map((row) => ({
    weekStart: row.week_start,
    body: row.body,
    updatedAt: row.updated_at,
  }));
};
