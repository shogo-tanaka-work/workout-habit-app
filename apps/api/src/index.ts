import { Hono } from 'hono';

import { analytics } from './routes/analytics';
import { backup } from './backup';
import type { AppEnv } from './env';
import { authenticate } from './middleware/authenticate';
import { apiTokens } from './routes/apiTokens';
import { feedback } from './routes/feedback';
import { goals } from './routes/goals';
import { me } from './routes/me';
import { plans } from './routes/plans';
import { profile } from './routes/profile';
import { sync } from './routes/sync';
import { trainingPhases } from './routes/trainingPhases';

// workout-habit の API。この Worker は API 専用で、静的アセットを持たない。
//
// **ブラウザから直接呼ばれることはない。** 管理画面は workout-habit-admin Worker が配信し、
// そこから Service Binding で中継されるため同一オリジン扱いになる。
// モバイルと Claude Code もブラウザ経由ではない。したがって CORS の設定を持たない。
//
// 認証は3経路。詳細は src/middleware/authenticate.ts と .agents/memory/auth-model.md。
// - ブラウザ（管理画面）: Cloudflare Access の JWT を Worker 側で再検証
// - モバイル: Google ID トークンを JWKS で検証
// - Claude Code（CLI）: users に紐付いた API トークン
//
// - GET  /health      … 死活確認（認証不要）
// - GET  /backup      … 本人の同期対象テーブルを返す（復元用。src/backup.ts）
// - POST /sync/operations … 操作（intent）ベースの同期。冪等・部分成功（src/routes/sync.ts）
// - GET  /me         … 自分の id / 表示名 / ロール（src/routes/me.ts）
// - GET  /plans       … 期間内の予定（status='planned'）を返す（src/routes/plans.ts）
// - GET  /analytics/* … 読み取り専用の分析API（src/routes/analytics.ts）
// - GET  /feedback    … 週次 AI フィードバックのアーカイブ（src/routes/feedback.ts）
// - GET  /goals       … 種目別の目標重量（src/routes/goals.ts）
// - GET  /training-phases … 減量期・増量期・中断の履歴（src/routes/trainingPhases.ts）
// - GET  /profile     … 基本情報（目的・身長・メモ）。未設定なら null（src/routes/profile.ts）
// - /admin/api-tokens … CLI トークンの発行・一覧・失効（admin のみ）

const app = new Hono<AppEnv>();

app.use('*', authenticate());

app.get('/health', (context) => context.json({ ok: true, service: 'workout-habit-api' }));

app.route('/backup', backup);
app.route('/sync', sync);
app.route('/plans', plans);
app.route('/me', me);
app.route('/analytics', analytics);
app.route('/feedback', feedback);
app.route('/goals', goals);
app.route('/training-phases', trainingPhases);
app.route('/profile', profile);
app.route('/admin/api-tokens', apiTokens);

export default app;
