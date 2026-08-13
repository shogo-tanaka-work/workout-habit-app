---
paths: "apps/api/**/*,apps/mobile/src/db/sync.ts,apps/web/src/api.ts"
---
# 秘密情報

**このリポジトリは public**。書いてよい値・書かない値の線引きは `.agents/memory/cloudflare.md` を読む。

## 必須ルール

- API トークン、Google OAuth の Client ID / Client Secret、Access AUD をコードや設定へ直書きしない
- サーバ側の秘密情報は Cloudflare Workers Secrets へ保存する（`wrangler secret put`）
- `wrangler.jsonc` の `vars` には公開可能な設定だけを書く
- ローカルの `.dev.vars` は `.gitignore` 済み。読まない、検索しない、表示しない
- ログ、例外、API レスポンスへ秘密値を含めない
- Secret の比較は通常の文字列比較ではなく、Web Crypto による固定時間比較を使う
- Secret 更新時は新しい値の動作確認後に古い値を失効させる
- 秘密値をチャット・コミットメッセージ・`docs/` へ書かない

## 保存先

| 種類 | 保存先 |
|---|---|
| サーバ側の秘密値 | Cloudflare Workers Secrets |
| 公開可能な実行設定 | `wrangler.jsonc` の `vars` |
| トレーニング記録 | D1（サーバ） / 端末内 SQLite（モバイル） |
| 端末側の認証情報 | **保存しない。** Google の ID トークンは有効期限1時間で、必要な時点で silent sign-in から取り直す（`src/auth/googleAuth.ts`）。ログイン状態はネイティブ SDK が保持する |
| Google OAuth のクライアント ID（モバイル） | `apps/mobile/.env.local`（gitignore 済み）。`app.config.js` が読む |
| 管理画面の認証情報 | **持たない。** Cloudflare Access のセッションクッキーで通る。`localStorage` に置くのは表示設定（週次目標）だけ |

### 現在 API が持つ Secret

| 名前 | 用途 |
|---|---|
| `ACCESS_TEAM_DOMAIN` | Cloudflare Access の JWKS 取得元 |
| `ACCESS_AUD` | Access アプリケーションの Audience |
| `GOOGLE_CLIENT_IDS` | モバイルの ID トークンで許可するクライアント ID（カンマ区切り） |

OAuth の Client Secret は API 側に無い（モバイルはネイティブ SDK 方式で Client ID だけを使う）。
`API_TOKEN` と `ALLOWED_ORIGINS` は旧経路の Secret で、**現在は参照していない**
（Claude Code 用のトークンは D1 の `api_tokens` にハッシュで持つ）。

D1 と `localStorage` へ平文の秘密情報を長期保存しない。
Claude Code 用のトークンは発行時のレスポンスでしか平文を返さず、保存はハッシュだけにする。
端末に平文で置いていた同期トークンは Google サインインへの移行時に削除した
（`apps/mobile/src/db/migrations.ts` の version 3）。

## 公開前チェック

コミット・push の前に確認する。

- `git diff` に トークン・メールアドレス・アカウント ID が含まれていないか
- 新規ファイルが `.gitignore` の対象から漏れていないか（`.dev.vars` / `docs/` / `dist/` / `.wrangler/`）
- スクリーンショットやログに個人情報・他社アプリの画面が写り込んでいないか
