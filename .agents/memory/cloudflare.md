# Cloudflare 構成

`apps/api` の Worker が D1 と静的アセットの両方を持つ単一デプロイ構成。

## リソース

```text
Worker: workout-habit-api
D1 database (binding: DB): workout-habit-db
compatibility_date: 2026-06-01
observability: enabled
```

`apps/api/wrangler.jsonc` は次の状態を維持する。

- `assets.directory` は `../web/dist`。`apps/web` のビルド成果物を同一オリジンで配信する
- `assets.not_found_handling` は `single-page-application`
- `assets.run_worker_first` は `["/backup", "/health", "/analytics/*"]`。
  ここに載っていないパスは Worker を通らず静的アセットが返る。**API を追加したらこの配列に必ず足す**
- D1 の binding 名は `DB`

同一オリジン配信のため CORS 設定は不要。web から API を叩くときは相対パスを使う。

## デプロイ

```bash
npm --prefix apps/api run deploy   # apps/web のビルド → wrangler deploy
```

`deploy` は `npm --prefix ../web run build` を先に走らせる。web だけ直した場合もこのコマンドを使う。

`wrangler` は `apps/api/` を作業ディレクトリにして実行する。`npm --prefix apps/api exec` は
インストール先を変えるだけで作業ディレクトリを変えないため、`wrangler.jsonc` を読めず
新規プロジェクトの雛形生成を提案してくる。使わない。

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
