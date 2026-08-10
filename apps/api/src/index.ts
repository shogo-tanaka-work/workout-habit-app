import { Hono } from 'hono';

import { analytics } from './analytics';
import { backup } from './backup';
import type { AppEnv } from './env';
import { authenticate } from './middleware/authenticate';
import { apiTokens } from './routes/apiTokens';
import { plans } from './routes/plans';
import { sync } from './routes/sync';

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
// - GET  /backup      … 本人の同期対象テーブルを返す（復元用）
// - POST /backup      … 本人の行だけを置き換える（src/backup.ts）
// - POST /sync/operations … 操作（intent）ベースの同期。冪等・部分成功（src/routes/sync.ts）
// - GET  /plans       … 期間内の予定（status='planned'）を返す（src/routes/plans.ts）
// - GET  /analytics/* … 読み取り専用の分析API（src/analytics.ts）
// - /admin/api-tokens … CLI トークンの発行・一覧・失効（admin のみ）

const app = new Hono<AppEnv>();

app.use('*', authenticate());

app.get('/health', (context) => context.json({ ok: true, service: 'workout-habit-api' }));

app.route('/backup', backup);
app.route('/sync', sync);
app.route('/plans', plans);
app.route('/analytics', analytics);
app.route('/admin/api-tokens', apiTokens);

export default app;
