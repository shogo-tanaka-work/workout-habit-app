// Claude Code（CLI）用トークンの発行・一覧・失効。admin だけが操作できる。
//
// 平文トークンは発行レスポンスでしか返さない。D1 にはハッシュだけを保存するため、
// 紛失時は再発行するしかない（意図的な設計）。

import { Hono } from 'hono';

import { generateApiToken, hashApiToken } from '../auth/apiToken';
import type { AppEnv } from '../env';
import { requireRole } from '../middleware/authorize';

/** トークン名の最大長。用途がわかる短いラベルを想定する。 */
const MAX_TOKEN_NAME_LENGTH = 64;

const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

type CreateTokenInput = { name: string; expiresAt: string | null };

const parseCreateInput = (body: unknown): CreateTokenInput | { error: string } => {
  if (typeof body !== 'object' || body === null) {
    return { error: 'body must be an object' };
  }
  const { name, expiresAt } = body as Record<string, unknown>;
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { error: 'name is required' };
  }
  if (name.length > MAX_TOKEN_NAME_LENGTH) {
    return { error: `name must be ${MAX_TOKEN_NAME_LENGTH} characters or less` };
  }
  if (expiresAt !== undefined && expiresAt !== null) {
    if (typeof expiresAt !== 'string' || !ISO_DATETIME_PATTERN.test(expiresAt)) {
      return { error: 'expiresAt must be an ISO 8601 UTC datetime' };
    }
  }
  return { name: name.trim(), expiresAt: (expiresAt as string | undefined) ?? null };
};

export const apiTokens = new Hono<AppEnv>();

apiTokens.use('*', requireRole('admin'));

apiTokens.get('/', async (context) => {
  const user = context.get('user');
  const result = await context.env.DB.prepare(
    `SELECT id, name, last_used_at, expires_at, revoked_at, created_at
     FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC`,
  )
    .bind(user.id)
    .all();
  return context.json({ tokens: result.results });
});

apiTokens.post('/', async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch (error) {
    return context.json(
      { error: `invalid json: ${error instanceof Error ? error.message : String(error)}` },
      400,
    );
  }
  const input = parseCreateInput(body);
  if ('error' in input) {
    return context.json({ error: input.error }, 400);
  }

  const user = context.get('user');
  const plainToken = generateApiToken();
  const tokenHash = await hashApiToken(plainToken);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await context.env.DB.prepare(
      `INSERT INTO api_tokens (id, user_id, name, token_hash, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.id, input.name, tokenHash, input.expiresAt, now, now)
      .run();
  } catch (error) {
    throw new Error(
      `api_tokens の作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }

  // token を返すのはこの1回だけ。以降はハッシュしか残らない。
  return context.json({ id, name: input.name, expiresAt: input.expiresAt, token: plainToken }, 201);
});

apiTokens.post('/:tokenId/revoke', async (context) => {
  const user = context.get('user');
  const now = new Date().toISOString();
  const result = await context.env.DB.prepare(
    `UPDATE api_tokens SET revoked_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(now, now, context.req.param('tokenId'), user.id)
    .run();
  if (result.meta.changes === 0) {
    return context.json({ error: 'token not found' }, 404);
  }
  return context.json({ ok: true, revokedAt: now });
});
