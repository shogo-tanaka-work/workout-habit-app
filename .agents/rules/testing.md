# 検証

変更後は対象アプリのコマンドを実行する。すべてリポジトリルートから実行できる。

## apps/mobile

自動テストは Jest（`jest-expo` preset）＋ `@testing-library/react-native`。
`src/**/__tests__/*.test.ts(x)` を対象にする。

```bash
npm --prefix apps/mobile test            # jest
npm --prefix apps/mobile run typecheck   # tsc --noEmit（テストも対象）
npm --prefix apps/mobile run lint        # eslint（eslint-config-expo）
npm --prefix apps/mobile run format      # prettier --write
npm --prefix apps/mobile run format:check
```

### テストの範囲

| 対象 | 方針 |
|---|---|
| `utils/` の純粋関数 | 境界（月またぎ・0件・上限）と、規則そのもの（WU を集計から外す等）を固定する |
| `db/` の書き込み | `src/test-support/fakeDatabase.ts` に発行 SQL を記録させ、条件と outbox への積み方を見る |
| `components/` `screens/` | 画面に出る文言と、押したときに親へ渡る値。スタイルの見た目は対象にしない |
| `hooks/` | `db/` をモックして「どの順で何を呼ぶか」を見る |

**ネイティブ実装が要る層はテストしない。** expo-sqlite の実 DB・expo-audio・通知は
`jest.setup.ts` で差し替え、実機の動線確認（下記）が受け持つ。

テスト用のドメイン値は `src/test-support/factories.ts` のビルダーで作る。
フィールドが増えるたび全テストが赤くなるのを避け、その検証の主題だけを書く。

**実行日に依存させない。** 「今日」を使う画面のテストは `formatDate(new Date())` から
組み立てる（固定日を書くと月初・月末・年またぎで落ちる）。

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
