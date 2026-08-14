// 基本情報（トレーニングの目的・身長・メモ）の取得。Step 11 の計画立案の前提。
//
// 書き込みは `POST /sync/operations` が受け持つ（専用の書き込み API は作らない）。
// 1ユーザー1行のため、未設定を 404 ではなく `profile: null` で表す
// （未設定は「エラー」ではなく通常の状態であり、クライアントは入力を促すだけでよい）。

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { loadUserProfile } from '../profile/queries';

export const profile = new Hono<AppEnv>();

profile.get('/', async (context) => {
  const entry = await loadUserProfile(context.env.DB, context.get('user'));
  return context.json({ profile: entry });
});
