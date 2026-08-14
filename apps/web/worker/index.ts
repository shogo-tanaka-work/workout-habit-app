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

/** 中継してよいメソッド。管理画面は読み取り専用のため GET / HEAD しか呼ばない。 */
const RELAY_METHODS: readonly string[] = ['GET', 'HEAD'];

// 静的アセット（dist）のレスポンスにだけ付けるセキュリティヘッダ。
// /api/* の中継レスポンスには付けない（中継時にヘッダを加工しない規則。rules/web-react.md）。
//
// CSP は現状の画面から逆算した最小構成。前提が崩れたら書き直す:
// - script は Vite が出力する自ホストの module script だけ。インライン script は無い
// - inline style 属性をバー幅の指定に使っている（ContinuitySection / BodyPartSection）ため
//   style-src に 'unsafe-inline' が要る
// - 画像・font・外部リソースは未使用。fetch は同一オリジンの /api/* のみ
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; " +
    "form-action 'none'",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/** アセット配信のレスポンスへセキュリティヘッダを付けて返す。 */
const withSecurityHeaders = (response: Response): Response => {
  // ASSETS の返すレスポンスはヘッダが immutable のため、複製してから足す。
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    secured.headers.set(name, value);
  }
  return secured;
};

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
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    }

    // 管理画面は読み取り専用（rules/web-react.md）。画面が書き込み系を呼ばない規約に加えて、
    // 中継の経路自体を GET / HEAD に閉じ、読み取り専用を構造的に強制する。
    if (!RELAY_METHODS.includes(request.method)) {
      return Response.json(
        { error: 'この画面の API は読み取り専用です（GET / HEAD のみ）' },
        { status: 405, headers: { Allow: 'GET, HEAD' } },
      );
    }

    // Access が付けた Cf-Access-Jwt-Assertion を含め、ヘッダはそのまま渡す。
    // API Worker が改めて署名・issuer・AUD を検証する（ヘッダを信用しない）。
    const upstreamUrl = new URL(request.url);
    upstreamUrl.pathname = url.pathname.slice(API_PREFIX.length);
    return env.API.fetch(new Request(upstreamUrl, request));
  },
};
