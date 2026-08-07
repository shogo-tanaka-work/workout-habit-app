import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { analytics } from './analytics';
import { backup } from './backup';
import type { AppEnv } from './env';
import { authenticate } from './middleware/authenticate';
import { apiTokens } from './routes/apiTokens';
import { sync } from './routes/sync';

// workout-habit の API。この Worker は API 専用で、静的アセットを持たない。
// 管理画面は別オリジン（workout-habit-admin Worker）が配信するため CORS が要る。
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
// - GET  /analytics/* … 読み取り専用の分析API（src/analytics.ts）
// - /admin/api-tokens … CLI トークンの発行・一覧・失効（admin のみ）

const parseAllowedOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

const app = new Hono<AppEnv>();

// CORS は認証より先に置く。プリフライト（OPTIONS）は Authorization を持たないため、
// 認証ミドルウェアより後ろに置くと 401 になってブラウザ側で失敗する。
app.use('*', (context, next) =>
  cors({
    origin: (requestOrigin) => {
      const allowed = parseAllowedOrigins(context.env.ALLOWED_ORIGINS);
      return allowed.includes(requestOrigin) ? requestOrigin : undefined;
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  })(context, next),
);

app.use('*', authenticate());

app.get('/health', (context) => context.json({ ok: true, service: 'workout-habit-api' }));

app.route('/backup', backup);
app.route('/sync', sync);
app.route('/analytics', analytics);
app.route('/admin/api-tokens', apiTokens);

export default app;
