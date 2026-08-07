// workout-habit-admin Worker のエントリ。
//
// 役割は2つだけ。
//   1. ビルド済みの管理画面（dist）を配信する
//   2. /api/* を API Worker（workout-habit-api）へ中継する
//
// **集計も認可もここでは行わない。** どちらも API Worker の責務であり、
// この Worker は経路を1つに束ねるだけ（.agents/AGENTS.md の責務境界）。
//
// なぜ中継するのか:
// Cloudflare Access はホスト単位で守るため、Access が付ける
// Cf-Access-Jwt-Assertion ヘッダは「この Worker のホスト宛」のリクエストにしか付かない。
// 画面から API Worker のオリジンを直接叩くと JWT が付かず、
// かといって API 側にも Access を掛けると未認証の XHR がログイン画面への
// リダイレクトを受けて壊れる。同一オリジンに寄せればこの問題ごと消える。
//
// 中継は Service Binding（Worker 間の直接呼び出し）で行うため、公開インターネットを経由しない。

/** /api を剥がして API Worker のパスへ直す。 */
const API_PREFIX = '/api';

type Fetcher = { fetch: (request: Request) => Promise<Response> };

type Env = {
  /** ビルド成果物（dist）。wrangler.jsonc の assets.binding。 */
  ASSETS: Fetcher;
  /** workout-habit-api への Service Binding。 */
  API: Fetcher;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) {
      return env.ASSETS.fetch(request);
    }

    // Access が付けた Cf-Access-Jwt-Assertion を含め、ヘッダはそのまま渡す。
    // API Worker が改めて署名・issuer・AUD を検証する（ヘッダを信用しない）。
    const upstreamUrl = new URL(request.url);
    upstreamUrl.pathname = url.pathname.slice(API_PREFIX.length);
    return env.API.fetch(new Request(upstreamUrl, request));
  },
};
