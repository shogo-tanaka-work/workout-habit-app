import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { analytics } from './analytics';
import type { BackupPayload } from './tables';
import { SYNC_TABLES } from './tables';

// workout-habit のクラウドバックアップ API（個人利用・単一ユーザー）。
// この Worker は API 専用で、静的アセットを持たない。
// 管理画面は別オリジン（workout-habit-admin Worker）が配信するため CORS が要る。
// 認証は Bearer トークン（API_TOKEN シークレット）1本で行う。
// - GET  /health  … 死活確認（認証不要）
// - GET  /backup  … D1 に保存された全テーブルを返す（復元用）
// - POST /backup  … 送られた全テーブルで D1 を置き換える（バックアップ）
// - GET  /analytics/* … 読み取り専用の分析API（src/analytics.ts）

// ALLOWED_ORIGINS は管理画面のオリジンをカンマ区切りで持つシークレット。
// 値自体は秘密ではないが、workers.dev のサブドメインをリポジトリへ書かないため
// vars ではなく Secret に置く。未設定なら CORS ヘッダを出さず、ブラウザ側で弾かれる。
type Bindings = Env & { API_TOKEN: string; ALLOWED_ORIGINS?: string };

const parseAllowedOrigins = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

// D1 の 1 クエリあたりのバインド変数上限（100）を超えないための行チャンクサイズ算出。
const MAX_BOUND_PARAMS = 90;
// 1 回の batch に積むステートメント数の上限（過大なバッチを避ける保守的な値）。
const MAX_STATEMENTS_PER_BATCH = 80;

const app = new Hono<{ Bindings: Bindings }>();

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

app.use('*', async (context, next) => {
  if (context.req.method === 'OPTIONS') {
    return next();
  }
  if (context.req.path === '/health') {
    return next();
  }
  const authorization = context.req.header('Authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!context.env.API_TOKEN || token !== context.env.API_TOKEN) {
    return context.json({ error: 'unauthorized' }, 401);
  }
  return next();
});

app.get('/health', (context) => context.json({ ok: true, service: 'workout-habit-api' }));

app.get('/backup', async (context) => {
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of SYNC_TABLES) {
    const result = await context.env.DB.prepare(
      `SELECT ${table.columns.join(', ')} FROM ${table.name}`,
    ).all();
    tables[table.name] = result.results as Record<string, unknown>[];
  }
  return context.json({ exportedAt: new Date().toISOString(), tables } satisfies BackupPayload);
});

app.post('/backup', async (context) => {
  let payload: BackupPayload;
  try {
    payload = await context.req.json<BackupPayload>();
  } catch (error) {
    return context.json(
      { error: `invalid json: ${error instanceof Error ? error.message : String(error)}` },
      400,
    );
  }
  if (typeof payload?.tables !== 'object' || payload.tables === null) {
    return context.json({ error: 'tables is required' }, 400);
  }

  // 全テーブルを DELETE → INSERT で置き換える。
  // D1 batch は 1 回ごとにトランザクションになるが、バインド変数上限のため
  // 複数バッチに分割する。途中失敗時は次回バックアップ成功で回復する前提（個人用途）。
  const statements: D1PreparedStatement[] = [];
  const counts: Record<string, number> = {};

  for (const table of SYNC_TABLES) {
    statements.push(context.env.DB.prepare(`DELETE FROM ${table.name}`));
    const rows = payload.tables[table.name] ?? [];
    counts[table.name] = rows.length;

    const rowsPerStatement = Math.max(1, Math.floor(MAX_BOUND_PARAMS / table.columns.length));
    for (let offset = 0; offset < rows.length; offset += rowsPerStatement) {
      const chunk = rows.slice(offset, offset + rowsPerStatement);
      const valuesClause = chunk
        .map(() => `(${table.columns.map(() => '?').join(', ')})`)
        .join(', ');
      const bindings = chunk.flatMap((row) => table.columns.map((column) => row[column] ?? null));
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO ${table.name} (${table.columns.join(', ')}) VALUES ${valuesClause}`,
        ).bind(...bindings),
      );
    }
  }

  try {
    for (let offset = 0; offset < statements.length; offset += MAX_STATEMENTS_PER_BATCH) {
      await context.env.DB.batch(statements.slice(offset, offset + MAX_STATEMENTS_PER_BATCH));
    }
  } catch (error) {
    return context.json(
      { error: `backup failed: ${error instanceof Error ? error.message : String(error)}` },
      500,
    );
  }

  return context.json({ ok: true, savedAt: new Date().toISOString(), counts });
});

app.route('/analytics', analytics);

export default app;
