// 認証済みユーザー自身の情報。管理画面が「誰として見ているか」を出すために使う。
//
// 認証ミドルウェアが持ち回るのは id と role だけ（毎リクエストで表示名まで引く必要がない）。
// この route は表示に要る分だけを追加で引く。
//
// **他人の情報は返さない。** 引くのは常に自分の行だけで、ユーザー一覧の経路は作らない。

import { Hono } from 'hono';

import type { AppEnv } from '../env';

type ProfileRow = {
  email: string;
  display_name: string | null;
  status: string;
};

export const me = new Hono<AppEnv>();

me.get('/', async (context) => {
  const user = context.get('user');
  const row = await context.env.DB.prepare(
    'SELECT email, display_name, status FROM users WHERE id = ?',
  )
    .bind(user.id)
    .first<ProfileRow>();

  // 認証を通っている以上、行は必ずある（resolveUser が引いている）。
  // 無いのは認証と認可の間で行が消えた場合だけなので、伏せずに 404 で知らせる。
  if (!row) {
    return context.json({ error: 'user not found' }, 404);
  }

  return context.json({
    id: user.id,
    role: user.role,
    status: row.status,
    email: row.email,
    // Access 経路のユーザーは JWT に名前が無く display_name が埋まらない。
    // 呼び出し側で分岐させず、ここで表示できる値へ寄せる。
    displayName: row.display_name ?? row.email,
  });
});
