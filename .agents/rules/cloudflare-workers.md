---
paths: "apps/api/src/**/*.ts,apps/api/wrangler.jsonc,apps/web/wrangler.jsonc"
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

## Worker は2つある

役割ごとに分けている。混同するとデプロイ先を間違える。

| Worker | 設定ファイル | 中身 |
|---|---|---|
| `workout-habit-api` | `apps/api/wrangler.jsonc` | API 専用。`main` あり、`assets` なし、D1 binding あり |
| `workout-habit-admin` | `apps/web/wrangler.jsonc` | 管理画面専用。`main` なし、`assets` のみ |

- **API Worker に `assets` を戻さない。** 分離した意味が無くなり、Access をホスト単位で
  掛けられなくなる
- 管理画面 Worker は Worker スクリプトを持たない。`main` は wrangler のスキーマ上任意
- 別オリジンのため CORS が要る。詳細は `.agents/rules/api.md` と `.agents/memory/cloudflare.md`

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
