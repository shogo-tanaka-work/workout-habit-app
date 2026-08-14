// レート制限（Workers Rate Limiting binding）の判定。
//
// 上限値の正本は wrangler.jsonc の ratelimits（binding ごとに limit / period を持つ）。
// どの binding をどのキーで使うかは呼び出し側が決める:
//   - AUTH_FAILURE_RATE_LIMITER … 認証失敗（キーは接続元 IP）
//   - SYNC_RATE_LIMITER         … POST /sync/operations（キーは認証済み userId）
//   - TOKEN_ISSUE_RATE_LIMITER  … POST /admin/api-tokens（キーは認証済み userId）

import type { Context } from 'hono';

import type { AppEnv } from '../env';

/** 超過時のレスポンス本文。エラー形式は { error: string } に統一する（api.md）。 */
export const rateLimitedResponse = (context: Context<AppEnv>) =>
  context.json({ error: 'too many requests' }, 429);

/**
 * レート制限を1回分消費し、上限内なら true を返す。
 *
 * limiter 呼び出し自体の失敗は**許可（true）に倒す（fail open）**。
 * レート制限は暴走・総当たりの頭打ちであって、認証と違って
 * 「判定できない＝本人でないかもしれない」にはならない。判定基盤の障害で
 * 正当なリクエストまで落とすと、同期できない端末が積み上がるだけで守るものが無い。
 */
export const consumeRateLimit = async (limiter: RateLimit, key: string): Promise<boolean> => {
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (error) {
    console.warn(
      '[rate-limit] 判定に失敗したため許可します',
      error instanceof Error ? error.message : String(error),
    );
    return true;
  }
};

/**
 * 接続元 IP をレート制限のキーにする。Cloudflare が付与する CF-Connecting-IP を使う。
 * 取れない環境（wrangler dev 等）は単一キーへ寄せる（開発時のみで実害は無い）。
 */
export const clientIpOf = (context: Context<AppEnv>): string =>
  context.req.header('CF-Connecting-IP') ?? 'unknown';
