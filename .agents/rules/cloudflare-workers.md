---
paths: "apps/api/src/**/*.ts,apps/api/wrangler.jsonc"
---
# Cloudflare Workers

構成の詳細は `.agents/memory/cloudflare.md` を読む。

- Bindings は `wrangler types` の生成型（`worker-configuration.d.ts`）を正本にし、Secret 名だけを型安全に拡張する
- Cloudflare のサービスは REST API ではなく Bindings 経由で利用する
- リクエスト固有の可変状態をモジュールスコープへ置かない（Worker のインスタンスは複数リクエストで再利用される）
- 外部 fetch と D1 操作の Promise を必ず追跡する
- 大きさが不明なレスポンスを無条件に全件バッファしない
- 構造化ログを使い、トークン・メールアドレス・トレーニング記録の中身をログへ出さない
- `compatibility_date` と Observability の設定を維持する

## 静的アセットとの共存

`apps/web` のビルド成果物を同じ Worker から配信している。ここが事故の起きやすい箇所。

- `assets.run_worker_first` に載っていないパスは **Worker を通らず静的アセットが返る**。
  API を追加したら必ずこの配列へ足す
- `not_found_handling` は `single-page-application`。未知のパスは `index.html` が返るため、
  存在しない API を叩くと 404 ではなく HTML が返る。デバッグ時はこれを疑う
- web だけ直した場合も `npm --prefix apps/api run deploy` を使う（web のビルドが前段に入っている）

## 変更後の反映

- Binding を変更したら `npm --prefix apps/api run types` で生成型を更新する
- `wrangler.jsonc` の編集だけでは本番へ反映されない。`wrangler deploy` まで行う
- 設定変更後は `npx wrangler deploy --dry-run` で検証する
- `wrangler` コマンドは `apps/api/` を作業ディレクトリにして実行する。
  `npm --prefix apps/api exec` はインストール先を変えるだけで作業ディレクトリを変えないため使わない
