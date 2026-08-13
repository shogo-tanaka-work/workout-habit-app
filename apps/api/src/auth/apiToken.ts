// Claude Code（CLI）経路: ユーザー単位の API トークンを検証する。
//
// CLI はブラウザリダイレクトを持たないため Access も Google サインインも使えない。
// 代わりに users に紐付いた不透明トークンを発行し、SHA-256 のハッシュだけを D1 に置く。
// 平文はここでもどこでも保存しない。

import type { Identity } from './types';

/** CLI トークンの接頭辞。Bearer が JWT か CLI トークンかをこれで判別する。 */
export const API_TOKEN_PREFIX = 'whk_';

/** 発行するトークンのランダム部のバイト数。 */
const TOKEN_RANDOM_BYTES = 32;

const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 平文トークンのハッシュ（hex）。D1 に保存するのはこの値だけ。 */
export const hashApiToken = async (plainToken: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plainToken));
  return toHex(new Uint8Array(digest));
};

/** 新しい平文トークンを発行する（保存はしない。呼び出し側が一度だけ表示する）。 */
export const generateApiToken = (): string => {
  const randomBytes = crypto.getRandomValues(new Uint8Array(TOKEN_RANDOM_BYTES));
  return `${API_TOKEN_PREFIX}${toBase64Url(randomBytes)}`;
};

type ApiTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string | null;
  revoked_at: string | null;
};

/**
 * CLI トークンを検証して Identity へ変換する。失効・期限切れ・未登録なら null。
 * 最終利用日時の記録は認証の成否に影響させない（失敗しても認証は通す）。
 */
export const verifyApiToken = async (
  database: D1Database,
  plainToken: string,
): Promise<Identity | null> => {
  const tokenHash = await hashApiToken(plainToken);
  let row: ApiTokenRow | null;
  try {
    row = await database
      .prepare(
        'SELECT id, user_id, token_hash, expires_at, revoked_at FROM api_tokens WHERE token_hash = ?',
      )
      .bind(tokenHash)
      .first<ApiTokenRow>();
  } catch (error) {
    throw new Error(
      `api_tokens の照会に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  // 照合は上の SQL（token_hash = ?）が済ませている。行が返った時点で一致は確定しており、
  // 取り出した値をもう一度比べても結果は変わらない。
  if (!row) {
    return null;
  }
  if (row.revoked_at !== null) {
    return null;
  }
  const now = new Date().toISOString();
  if (row.expires_at !== null && row.expires_at <= now) {
    return null;
  }

  try {
    await database
      .prepare('UPDATE api_tokens SET last_used_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, row.id)
      .run();
  } catch (error) {
    console.warn('[auth] api_tokens.last_used_at の更新に失敗', error instanceof Error ? error.message : '');
  }

  return { kind: 'apiToken', userId: row.user_id };
};
