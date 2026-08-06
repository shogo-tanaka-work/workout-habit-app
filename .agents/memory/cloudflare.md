# Cloudflare 構成

**役割ごとに Worker を2つに分けている。** 2026-08-07 に単一 Worker 構成から移行した。

## リソース

```text
Worker: workout-habit-api      ← API 専用（apps/api）。静的アセットを持たない
  D1 database (binding: DB): workout-habit-db
  Secret: API_TOKEN, ALLOWED_ORIGINS

Worker: workout-habit-admin    ← 管理画面専用（apps/web）。Worker スクリプトを持たない
  静的アセットのみ

compatibility_date: 2026-06-01（両方）
observability: enabled（API 側）
```

分離した理由は、Cloudflare Access を管理画面のホストへ**まるごと適用**できるようにするため。
単一 Worker だと、Access をルートに掛けるとモバイルからの `/backup` も巻き込む。

### apps/api/wrangler.jsonc

- `main` は `src/index.ts`。**`assets` は持たない**
- D1 の binding 名は `DB`、`migrations_dir` は `migrations`
- API のパスはルート直下（`/health` `/backup` `/analytics/*`）。
  名前空間を共有する静的アセットが無いため `/api/*` の接頭辞は付けていない

### apps/web/wrangler.jsonc

- `main` を持たない**静的アセットのみの Worker**（wrangler のスキーマ上 `main` は任意）
- `assets.directory` は `./dist`、`not_found_handling` は `single-page-application`

### CORS

別オリジンになったため `apps/api` に Hono の `cors()` を入れている。

- 許可オリジンは **`ALLOWED_ORIGINS` シークレット**（カンマ区切り）で渡す。
  値は秘密ではないが、`workers.dev` のサブドメインをリポジトリへ書かないため `vars` を使わない
- 未設定なら CORS ヘッダを出さない fail closed
- CORS ミドルウェアは**認証より前**に置く。プリフライト（OPTIONS）は `Authorization` を持たないため、
  認証を先に通すと 401 になってブラウザ側で失敗する

### 管理画面の接続先

`apps/web` はビルド時に `VITE_API_ORIGIN` を埋め込む。`apps/web/.env.local` に置く
（`env.example` をコピーする）。**未設定でビルドすると画面が設定漏れのメッセージを出す。**

## デプロイ

2本に分かれている。どちらか一方だけの変更でも、そちらだけを打てばよい。

```bash
npm --prefix apps/api run deploy   # wrangler deploy
npm --prefix apps/web run deploy   # vite build → wrangler deploy
```

`wrangler` は対象アプリのディレクトリを作業ディレクトリにして実行する。
`npm --prefix <app> exec` はインストール先を変えるだけで作業ディレクトリを変えないため、
`wrangler.jsonc` を読めず新規プロジェクトの雛形生成を提案してくる。使わない。

Binding を変更したら `npm --prefix apps/api run types` で `worker-configuration.d.ts` を更新する。

## リポジトリへ書いてよい値・書かない値

このリポジトリは public。

書いてよい: Worker 名、D1 データベース名、binding 名、`compatibility_date`、assets の設定、
エンドポイントのパスとレスポンス形状。

書かない: Cloudflare アカウント ID、`workers.dev` のサブドメイン、Access team domain、Access AUD、
許可メールアドレス、`API_TOKEN` の値、Google OAuth の Client ID / Client Secret。
これらは `~/agents-share/projects/` 側か Cloudflare ダッシュボードにのみ置く。

`wrangler.jsonc` の `database_id` は秘密値ではないが、単体では利用できない識別子として扱い、
アカウント ID と組にして書かない。

ローカル開発で必要になる本番 Worker のオリジンは `apps/web/.env.local` の `VITE_API_ORIGIN` に置く。
リポジトリには `apps/web/env.example` のプレースホルダだけを残す（`.env.local` は `.gitignore` 済み）。
ファイル名が `.env.example` でなく `env.example` なのは、ローカルのツール制約で
ドット始まりの env ファイルを扱えないため。
