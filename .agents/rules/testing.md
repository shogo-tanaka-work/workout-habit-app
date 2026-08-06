# 検証

自動テストは未整備。変更後は最低限、対象アプリのコマンドを実行する。
すべてリポジトリルートから実行できる。

## apps/mobile

```bash
npm --prefix apps/mobile run typecheck   # tsc --noEmit
npm --prefix apps/mobile run lint        # eslint（eslint-config-expo）
npm --prefix apps/mobile run format      # prettier --write
```

UI・DB を変更したら実機かシミュレータで確認する（`npm --prefix apps/mobile run ios`）。
特に確認する動線:

- レストタイマーが画面遷移・バックグラウンド復帰後も正しく動く
- スキーマ変更後、**既存データを持つ端末**でクラッシュせず起動する
- 機内モード（オフライン）で記録・閲覧・タイマーがすべて動く

## apps/web

```bash
npm --prefix apps/web run build   # tsc --noEmit && vite build
```

UI を変更したら 1440px / 1024px / 768px / 390px で確認し、
`scrollWidth` が `clientWidth` を超えていないことを確認する。

## apps/api

```bash
npm --prefix apps/api run typecheck
cd apps/api && npx wrangler deploy --dry-run
```

`wrangler` は `apps/api/` を作業ディレクトリにして実行する。
`npm --prefix apps/api exec` は作業ディレクトリを変えないため使わない。

エンドポイントを追加・変更したら、ローカル Worker（`npm --prefix apps/api run dev`）へ
実際にリクエストを投げてレスポンス形状を確認する。
管理画面から使うエンドポイントは、`ALLOWED_ORIGINS` の許可漏れがないかも確認する
（ブラウザのコンソールに CORS エラーが出る）。

## 変更が複数アプリにまたがる場合

スキーマ・同期対象・API レスポンス形状の変更は3アプリに波及する。
以下を同じ変更セットで直し、3つとも検証する。

- `apps/mobile/src/db/schema.ts` と `migrations.ts` ⇔ `apps/api/migrations/`
- `apps/mobile/src/db/sync.ts` の `SYNC_TABLES` ⇔ `apps/api/src/tables.ts` の `SYNC_TABLES`
- `apps/api/src/analytics.ts` のレスポンス ⇔ `apps/web/src/types/api.ts`

## コミット前

`.agents/rules/secrets.md` の「公開前チェック」を実行する。リポジトリは public。
