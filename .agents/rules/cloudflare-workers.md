---
paths: "apps/api/src/**/*.ts,apps/api/wrangler.jsonc,apps/web/wrangler.jsonc,apps/web/worker/**/*.ts"
---
# Cloudflare Workers

構成の詳細は `.agents/memory/cloudflare.md` を読む。

- Bindings は `wrangler types` の生成型（`worker-configuration.d.ts`）を正本にし、Secret 名だけを型安全に拡張する
- Cloudflare のサービスは REST API ではなく Bindings 経由で利用する
- リクエスト固有の可変状態をモジュールスコープへ置かない（Worker のインスタンスは複数リクエストで再利用される）
- 外部 fetch と D1 操作の Promise を必ず追跡する
- `ctx.waitUntil()` に回してよいのは**レスポンス内容に影響しない後処理だけ**（ログ・台帳の更新など）。
  レスポンスに関わる処理は `await` する
- `ctx` を分割代入しない（`const { waitUntil } = ctx` は `this` バインドが失われ実行時エラーになる）
- 大きさが不明なレスポンスを無条件に全件バッファしない
- 構造化ログを使い、トークン・メールアドレス・トレーニング記録の中身をログへ出さない
- `compatibility_date` と Observability の設定を維持する

## Worker は2つある

役割ごとに分けている。混同するとデプロイ先を間違える。

| Worker | 設定ファイル | 中身 |
|---|---|---|
| `workout-habit-api` | `apps/api/wrangler.jsonc` | API 専用。`main` あり、`assets` なし、D1 binding あり |
| `workout-habit-admin` | `apps/web/wrangler.jsonc` | 管理画面。`main`（`worker/index.ts`）＋ `assets` ＋ API への Service Binding |

- **API Worker に `assets` を戻さない。** 分離した意味が無くなり、Access をホスト単位で
  掛けられなくなる
- 管理画面 Worker の役割は「`dist` の配信」と「`/api/*` を Service Binding で API へ中継」の2つだけ。
  集計も認可もここでしない
- **CORS は持たない。** 中継によって画面と API が同一オリジンになるため。理由は `rules/api.md`、
  構成の詳細は `memory/cloudflare.md`
- **API Worker は転送されたヘッダを信用せず、改めて JWT を検証する**

## 変更後の反映

- Binding を変更したら `npm --prefix apps/api run types` で生成型を更新する
- `wrangler.jsonc` の編集だけでは本番へ反映されない。`wrangler deploy` まで行う
- 設定変更後は `npx wrangler deploy --dry-run` で検証する
- デプロイは2本に分かれている。変更した側だけを打てばよい

```bash
npm --prefix apps/api run deploy   # wrangler deploy
npm --prefix apps/web run deploy   # vite build → wrangler deploy
```

- `wrangler` コマンドは対象アプリのディレクトリを作業ディレクトリにして実行する。
  `npm --prefix <app> exec` はインストール先を変えるだけで作業ディレクトリを変えないため使わない
