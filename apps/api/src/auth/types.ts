// 認証・認可の共通型。
//
// 認証（誰か）→ 認可（使ってよいか）→ スコープ（どの行を触れるか）の3段のうち、
// このファイルは1段目と2段目の受け渡し口を定義する。
// email や google_sub は解決後のロジックで使わないため、意図的に持ち回らない
// （ログ・レスポンスへ漏れる経路を最初から作らない）。

export type Role = 'admin' | 'member';

export type AuthenticatedUser = {
  id: string;
  role: Role;
};

/** 認証（1段目）の結果。どの経路で本人確認できたかを表す。 */
export type Identity =
  | { kind: 'google'; googleSub: string; email: string; displayName: string | null }
  | { kind: 'access'; email: string }
  | { kind: 'apiToken'; userId: string };

/** Hono の Variables。認証済みユーザーはリクエストコンテキストで持ち回る。 */
export type AuthVariables = {
  user: AuthenticatedUser;
};

/**
 * 認証・認可に使う Secret。いずれも `wrangler secret put` で設定する。
 * 未設定の経路は利用できない（fail closed）。
 */
export type AuthBindings = {
  /** Cloudflare Access のチームドメイン（例: example.cloudflareaccess.com）。 */
  ACCESS_TEAM_DOMAIN?: string;
  /** Cloudflare Access のアプリケーション AUD タグ。 */
  ACCESS_AUD?: string;
  /** Google OAuth クライアント ID。iOS 用・Web 用をカンマ区切りで持つ。 */
  GOOGLE_CLIENT_IDS?: string;
};
