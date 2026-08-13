# 検証

自動テストは未整備。変更後は最低限、対象アプリのコマンドを実行する。
すべてリポジトリルートから実行できる。

## apps/mobile

```bash
npm --prefix apps/mobile run typecheck   # tsc --noEmit
npm --prefix apps/mobile run lint        # eslint（eslint-config-expo）
npm --prefix apps/mobile run format      # prettier --write
npm --prefix apps/mobile run format:check
```

UI・DB を変更したら実機かシミュレータで確認する（`npm --prefix apps/mobile run ios`）。
特に確認する動線:

- レストタイマーが画面遷移・バックグラウンド復帰後も正しく動く
- スキーマ変更後、**既存データを持つ端末**でクラッシュせず起動する
- 機内モード（オフライン）で記録・閲覧・タイマーがすべて動く
- オーバーレイ画面（種目詳細・記録の編集・設定のサブ画面）から `‹` で戻れる。
  戻り先が元のタブ・元の階層になっている
- タブを移って戻ったとき、設定タブが入口のメニューへ戻っている

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
管理画面は `workout-habit-admin` の Service Binding 中継で同一オリジンになるため、
CORS の確認は要らない（API に CORS 実装を持たない）。
ただし `npm --prefix apps/web run dev` では中継役の Worker が居らず `/api/*` が 404 になる。
データを伴う確認はデプロイ後の環境で行う。

## 変更が複数アプリにまたがる場合

スキーマ・同期対象・API レスポンス形状の変更は3アプリに波及する。
以下を同じ変更セットで直し、3つとも検証する。

- `apps/mobile/src/db/schema.ts` と `migrations.ts` ⇔ `apps/api/migrations/`
- `apps/mobile/src/db/syncTables.ts` の `SYNC_COLUMNS` ⇔ `apps/api/src/tables.ts` の `SYNC_TABLES`
- `apps/api/src/routes/analytics.ts` のレスポンス ⇔ `apps/web/src/types/api.ts`
- `apps/mobile/src/utils/oneRepMax.ts` の除数 ⇔ `apps/api/src/analytics/sql.ts` の `rmDivisorSql`
- `apps/mobile/src/db/seed.ts` の `seedExercises` ⇔ D1 の `exercises`（`owner_user_id IS NULL`）

## コミット前

`.agents/rules/secrets.md` の「公開前チェック」を実行する。リポジトリは public。
