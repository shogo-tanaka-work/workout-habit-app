// JWKS を使った RS256 JWT の検証。Workers の Web Crypto だけで完結させる。
//
// 検証は「アルゴリズム → 鍵の選択 → 署名 → クレーム」の順で行い、
// 1つでも満たさなければ null を返す。呼び出し側は理由をレスポンスへ書かない。
//
// 失敗理由を戻り値で区別しないのは意図的（どのチェックで落ちたかを外部へ漏らさない）。
// 調査に要る情報は console.warn へ出す。トークン本体・メール・sub は出さない。

import { isRecord } from '../utils/isRecord';

const SUPPORTED_ALGORITHM = 'RS256';
const JWT_SEGMENT_COUNT = 3;
/** 端末とサーバの時刻ずれの許容幅。 */
const CLOCK_SKEW_SECONDS = 60;
/** JWKS のキャッシュ保持時間。鍵ローテーションに追随できる程度に短く保つ。 */
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;

type JsonWebKey = {
  kid?: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtClaims = {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  name?: string;
  exp?: number;
  nbf?: number;
};

type JwtVerifyOptions = {
  jwksUrl: string;
  /** 許可する発行元。完全一致で照合する。 */
  issuers: readonly string[];
  /** 許可する aud。1つでも一致すれば通す。 */
  audiences: readonly string[];
};

type JwksCacheEntry = { keys: JsonWebKey[]; expiresAt: number };

// JWKS は公開鍵であり、リクエスト固有の状態ではないためモジュールスコープで保持してよい。
// キーは JWKS の URL。値は TTL 付きのキャッシュ。
const jwksCache = new Map<string, JwksCacheEntry>();

const decodeBase64Url = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const decodeJsonSegment = <T>(segment: string): T | null => {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment))) as T;
  } catch (error) {
    console.warn('[auth] JWT セグメントの復号に失敗', error instanceof Error ? error.message : '');
    return null;
  }
};

// エラーメッセージへ JWKS の URL を入れない。Access の team domain を含むため、
// 500 レスポンス経由やログで構成情報が漏れる経路になる。
const fetchJwks = async (jwksUrl: string): Promise<JsonWebKey[]> => {
  const response = await fetch(jwksUrl, { cf: { cacheTtl: 600 } });
  if (!response.ok) {
    throw new Error(`JWKS の取得に失敗しました: HTTP ${response.status}`);
  }
  // 外部から来る JSON はアサーションで通さず、境界で形を確かめる。
  const body: unknown = await response.json();
  const keys = isRecord(body) ? body.keys : undefined;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('JWKS の形式が不正です');
  }
  return keys as JsonWebKey[];
};

/**
 * JWKS を取得する。`forceRefresh` はキャッシュに無い kid を引いたときの再取得に使う
 * （鍵ローテーション直後を救済する）。取得に失敗したら例外を投げる＝fail closed。
 */
const loadJwks = async (jwksUrl: string, forceRefresh: boolean): Promise<JsonWebKey[]> => {
  const cached = jwksCache.get(jwksUrl);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }
  const keys = await fetchJwks(jwksUrl);
  jwksCache.set(jwksUrl, { keys, expiresAt: Date.now() + JWKS_CACHE_TTL_MS });
  return keys;
};

const selectKey = (keys: readonly JsonWebKey[], kid: string | undefined): JsonWebKey | null =>
  keys.find(
    (key) =>
      key.kty === 'RSA' &&
      (key.alg ?? SUPPORTED_ALGORITHM) === SUPPORTED_ALGORITHM &&
      (kid === undefined || key.kid === kid),
  ) ?? null;

const importVerificationKey = (key: JsonWebKey): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'jwk',
    { kty: key.kty, n: key.n, e: key.e, alg: SUPPORTED_ALGORITHM, ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

const audienceMatches = (
  claimed: string | string[] | undefined,
  allowed: readonly string[],
): boolean => {
  const values = typeof claimed === 'string' ? [claimed] : (claimed ?? []);
  return values.some((value) => allowed.includes(value));
};

const claimsAreValid = (claims: JwtClaims, options: JwtVerifyOptions): boolean => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!claims.iss || !options.issuers.includes(claims.iss)) {
    return false;
  }
  if (!audienceMatches(claims.aud, options.audiences)) {
    return false;
  }
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
    return false;
  }
  if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_SECONDS > nowSeconds) {
    return false;
  }
  return true;
};

/**
 * RS256 の JWT を検証し、正当ならクレームを返す。不正なら null。
 * JWKS の取得失敗は例外として投げる（設定不備・障害を「認証成功」に倒さない）。
 */
export const verifyJwt = async (
  token: string,
  options: JwtVerifyOptions,
): Promise<JwtClaims | null> => {
  const segments = token.split('.');
  if (segments.length !== JWT_SEGMENT_COUNT) {
    return null;
  }
  const [headerSegment, payloadSegment, signatureSegment] = segments;

  const header = decodeJsonSegment<JwtHeader>(headerSegment);
  if (!header || header.alg !== SUPPORTED_ALGORITHM) {
    return null;
  }

  let keys = await loadJwks(options.jwksUrl, false);
  let key = selectKey(keys, header.kid);
  if (!key) {
    keys = await loadJwks(options.jwksUrl, true);
    key = selectKey(keys, header.kid);
  }
  if (!key) {
    console.warn('[auth] JWT の kid に一致する鍵が JWKS にありません');
    return null;
  }

  const signedData = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const signature = decodeBase64Url(signatureSegment);
  let isSignatureValid = false;
  try {
    const verificationKey = await importVerificationKey(key);
    isSignatureValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      verificationKey,
      signature,
      signedData,
    );
  } catch (error) {
    throw new Error(
      `JWT の署名検証に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (!isSignatureValid) {
    return null;
  }

  const claims = decodeJsonSegment<JwtClaims>(payloadSegment);
  if (!claims || !claimsAreValid(claims, options)) {
    return null;
  }
  return claims;
};

/** カンマ区切りの Secret を配列にする（空要素は落とす）。 */
export const parseCsvSecret = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
