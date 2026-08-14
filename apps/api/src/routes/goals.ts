// 種目別の目標重量の取得。Step 9 の管理画面表示用。
//
// 書き込みは `POST /sync/operations` が受け持つ（専用の書き込み API は作らない）。
// UNIQUE(user_id, exercise_id) のため1種目1件で、件数は有限（期間パラメータを持たない）。

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { loadExerciseGoals } from '../goals/queries';

export const goals = new Hono<AppEnv>();

goals.get('/', async (context) => {
  const entries = await loadExerciseGoals(context.env.DB, context.get('user'));
  return context.json({ goals: entries });
});
