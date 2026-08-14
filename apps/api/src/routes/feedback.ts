// 週次 AI フィードバックの取得。Step 9 のアーカイブ表示用。
//
// Claude Code は `POST /sync/operations` でフィードバックを書き込む（専用の書き込み API は作らない）。
// この route が受け持つのは読む向きだけで、route は「入力の解釈 → 呼び出し → JSON 化」に留める。
// 期間の解釈は analytics/period.ts と同じ規則を使う（months は 1〜24・既定 6）。

import { Hono } from 'hono';

import { monthlyPeriod } from '../analytics/period';
import type { AppEnv } from '../env';
import { loadWeeklyFeedback } from '../feedback/queries';

const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 24;

export const feedback = new Hono<AppEnv>();

feedback.get('/', async (context) => {
  const { since } = monthlyPeriod(context.req.query(), DEFAULT_MONTHS, MAX_MONTHS);
  const entries = await loadWeeklyFeedback(context.env.DB, since, context.get('user'));
  return context.json({ feedback: entries });
});
