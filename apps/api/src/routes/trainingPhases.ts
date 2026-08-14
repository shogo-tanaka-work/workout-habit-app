// トレーニングのフェーズ履歴の取得。Step 10 の計画立案の前提。
//
// 書き込みは `POST /sync/operations` が受け持つ（専用の書き込み API は作らない）。
// UNIQUE(user_id, started_on) のため1開始日1件で、件数は有限（期間パラメータを持たない）。

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { loadTrainingPhases } from '../trainingPhases/queries';

export const trainingPhases = new Hono<AppEnv>();

trainingPhases.get('/', async (context) => {
  const entries = await loadTrainingPhases(context.env.DB, context.get('user'));
  return context.json({ phases: entries });
});
