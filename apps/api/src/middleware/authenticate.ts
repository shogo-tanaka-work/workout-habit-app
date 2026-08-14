// 認証ミドルウェア。経路の違いをここで吸収し、以降のロジックへは
// 「ユーザー ID + ロール」だけを渡す。
//
// 経路の判別:
//   Cf-Access-Jwt-Assertion ヘッダあり  → ブラウザ（Cloudflare Access）
//   Authorization: Bearer whk_...      → Claude Code（CLI トークン）
//   Authorization: Bearer <JWT>        → モバイル（Google ID トークン）
//
// 認証不要のパスは許可リストで持つ。「特定パスだけ弾く」形にはしない。

import type { Context, MiddlewareHandler } from 'hono';

import { ACCESS_JWT_HEADER, verifyAccessJwt } from '../auth/access';
import { API_TOKEN_PREFIX, verifyApiToken } from '../auth/apiToken';
import { verifyGoogleIdToken } from '../auth/google';
import type { Identity } from '../auth/types';
import { resolveUser } from '../auth/users';
import type { AppEnv } from '../env';
import { clientIpOf, consumeRateLimit, rateLimitedResponse } from './rateLimit';

/** 認証を要さないパス。追加時は必ず理由を伴って明示的に足す。 */
const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/health']);

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

const identify = async (context: Context<AppEnv>): Promise<Identity | null> => {
  const accessToken = context.req.header(ACCESS_JWT_HEADER);
  if (accessToken) {
    return verifyAccessJwt(accessToken, context.env);
  }

  const bearer = BEARER_PATTERN.exec(context.req.header('Authorization') ?? '')?.[1]?.trim();
  if (!bearer) {
    return null;
  }
  if (bearer.startsWith(API_TOKEN_PREFIX)) {
    return verifyApiToken(context.env.DB, bearer, context.executionCtx);
  }
  return verifyGoogleIdToken(bearer, context.env.GOOGLE_CLIENT_IDS);
};

export const authenticate = (): MiddlewareHandler<AppEnv> => async (context, next) => {
  if (PUBLIC_PATHS.has(context.req.path)) {
    return next();
  }

  // Secret 未設定・JWKS 取得失敗はここへ来る。認証をスキップせず 500 で止める（fail closed）。
  try {
    const identity = await identify(context);
    if (!identity) {
      // 認証の失敗だけを数える（成功リクエストは対象外）。トークン総当たりの頭打ち。
      const withinLimit = await consumeRateLimit(
        context.env.AUTH_FAILURE_RATE_LIMITER,
        clientIpOf(context),
      );
      if (!withinLimit) {
        return rateLimitedResponse(context);
      }
      return context.json({ error: 'unauthorized' }, 401);
    }
    const user = await resolveUser(context.env.DB, identity, context.executionCtx);
    if (!user) {
      return context.json({ error: 'forbidden' }, 403);
    }
    context.set('user', user);
  } catch (error) {
    console.error('[auth] 認証処理に失敗', error instanceof Error ? error.message : String(error));
    return context.json({ error: 'authentication unavailable' }, 500);
  }

  return next();
};
