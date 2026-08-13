# Cloudflare 構成

**役割ごとに Worker を2つに分けている。** 2026-08-07 に単一 Worker 構成から移行した。

## リソース

```text
Worker: workout-habit-api      ← API 専用（apps/api）。静的アセットを持たない
  D1 database (binding: DB): workout-habit-db
  Secret: ACCESS_TEAM_DOMAIN, ACCESS_AUD, GOOGLE_CLIENT_IDS

Worker: workout-habit-admin    ← 管理画面（apps/web）
  静的アセット（dist）＋ worker/index.ts
  Service binding (API): workout-habit-api

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

- `main` は `worker/index.ts`、`assets.directory` は `./dist`、
  `not_found_handling` は `single-page-application`
- `services` で `workout-habit-api` を binding 名 `API` として持つ
- `run_worker_first` により `/api/*` は静的アセットより先に Worker が受ける

### CORS は持たない（2026-08-08 に廃止）

画面から API を**同一オリジンで**呼ぶ形にしたため、CORS そのものが不要になった。

`/api/*` は `workout-habit-admin` の Worker が受け、Service Binding で
`workout-habit-api` へ中継する。公開インターネットを経由しない。

- 以前あった `ALLOWED_ORIGINS` シークレットと Hono の `cors()` は削除済み
- **API Worker は転送されたヘッダを信用せず、改めて JWT を検証する**

なぜ中継するのか。Cloudflare Access は**ホスト単位**で守るため、Access が付ける
`Cf-Access-Jwt-Assertion` はそのホスト宛のリクエストにしか付かない。画面から API Worker の
オリジンを直接叩くと JWT が付かず、かといって API 側にも Access を掛けると、
未認証の XHR がログイン画面へのリダイレクトを受けて壊れる。

### 管理画面の接続先

ビルド時の環境変数は無い。API は同一オリジンの `/api` 固定（`apps/web/src/api.ts`）。

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
