// ブラウザ経路: Cloudflare Access の JWT を検証する。
//
// Access を通っている前提でヘッダを信用しない。Worker 側で署名・iss・aud を再検証する。
// Access はチームドメイン配下の certs エンドポイントで公開鍵を配る。

import type { Identity } from './types';
import { verifyJwt } from './jwt';

/** Access が JWT を載せてくるヘッダ。 */
export const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion';

const certsUrlOf = (teamDomain: string): string =>
  `https://${teamDomain}/cdn-cgi/access/certs`;

const issuerOf = (teamDomain: string): string => `https://${teamDomain}`;

type AccessBindings = { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string };

/**
 * Access JWT を検証して Identity へ変換する。
 * 不正なら null。team domain / AUD 未設定なら例外（fail closed）。
 */
export const verifyAccessJwt = async (
  token: string,
  bindings: AccessBindings,
): Promise<Identity | null> => {
  const teamDomain = bindings.ACCESS_TEAM_DOMAIN?.trim();
  const audience = bindings.ACCESS_AUD?.trim();
  if (!teamDomain || !audience) {
    throw new Error(
      'ACCESS_TEAM_DOMAIN / ACCESS_AUD が未設定のため Access 経路の認証を行えません',
    );
  }

  const claims = await verifyJwt(token, {
    jwksUrl: certsUrlOf(teamDomain),
    issuers: [issuerOf(teamDomain)],
    audiences: [audience],
  });
  if (!claims?.email) {
    return null;
  }

  // Access の sub は Google の sub とは別物のため、users の解決には email だけを使う。
  return { kind: 'access', email: claims.email.toLowerCase() };
};
