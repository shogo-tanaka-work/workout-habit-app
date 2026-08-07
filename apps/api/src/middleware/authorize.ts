// ロール判定。各 route に role === 'admin' を散らさず、ここへ集約する。

import type { MiddlewareHandler } from 'hono';

import type { Role } from '../auth/types';
import type { AppEnv } from '../env';

/** 指定したロールでなければ 403。認証ミドルウェアより後ろに置く。 */
export const requireRole =
  (role: Role): MiddlewareHandler<AppEnv> =>
  async (context, next) => {
    if (context.get('user').role !== role) {
      return context.json({ error: 'forbidden' }, 403);
    }
    return next();
  };
