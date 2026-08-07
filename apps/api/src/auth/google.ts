// モバイル経路: Google の ID トークンを検証する。
//
// Google のネイティブ SDK が返す ID トークンを、API 側が JWKS で自前検証する。
// aud は Google Cloud で作成した OAuth クライアント ID（iOS 用・Web 用）。

import type { Identity } from './types';
import { parseCsvSecret, verifyJwt } from './jwt';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
// Google は歴史的経緯で2種類の iss を発行する。どちらも正当。
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;

type GoogleClaims = {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
};

const isEmailVerified = (value: boolean | string | undefined): boolean =>
  value === true || value === 'true';

/**
 * Google ID トークンを検証して Identity へ変換する。
 * 不正・未検証メールなら null。Client ID 未設定なら例外（fail closed）。
 */
export const verifyGoogleIdToken = async (
  token: string,
  clientIdsSecret: string | undefined,
): Promise<Identity | null> => {
  const audiences = parseCsvSecret(clientIdsSecret);
  if (audiences.length === 0) {
    throw new Error('GOOGLE_CLIENT_IDS が未設定のため Google 経路の認証を行えません');
  }

  const claims = await verifyJwt(token, {
    jwksUrl: GOOGLE_JWKS_URL,
    issuers: GOOGLE_ISSUERS,
    audiences,
  });
  if (!claims) {
    return null;
  }

  const googleClaims = claims as GoogleClaims;
  // sub はユーザーの不変 ID、email は招待との突き合わせに使う。どちらも欠けたら通さない。
  if (!googleClaims.sub || !googleClaims.email || !isEmailVerified(googleClaims.email_verified)) {
    return null;
  }

  return {
    kind: 'google',
    googleSub: googleClaims.sub,
    email: googleClaims.email.toLowerCase(),
    displayName: googleClaims.name ?? null,
  };
};
