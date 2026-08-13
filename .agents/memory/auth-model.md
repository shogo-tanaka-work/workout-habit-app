# 認証モデル

Step 4 で実装済み。API・モバイル・管理画面の3経路が動いている。

設計の詳細（認証・認可・スコープの分離、`users` テーブル、登録ポリシー、
守れること・守れないこと）は `docs/10_プロダクト設計/認証認可の設計.md` にある。実装前に読む。

## 実装状況

| 段 | 内容 | 実装 |
|---|---|---|
| 認証 | Access JWT / Google ID トークン / CLI トークンの検証 | 済（`src/auth/`） |
| 認可 | `users` を引き、登録が無ければ 403 | 済（`src/auth/users.ts`） |
| スコープ | `user_id` で行を絞る | 済（`src/db/scope.ts`） |
| モバイルのログイン | Google サインイン導入 | 済 |
| 管理画面 | Cloudflare Access の適用 | 済（同一オリジン中継。画面はトークンを持たない） |

旧来の単一 Bearer トークン（`API_TOKEN`）の経路は削除済み。

管理画面は**同一オリジン化**した。`workout-habit-admin` Worker が `/api/*` を
Service Binding で `workout-habit-api` へ中継する。Access はホスト単位でしか
JWT を付けないため、別オリジンのままでは画面から API を呼べないことによる
（詳細は `apps/web/AGENTS.md`）。

`GOOGLE_CLIENT_IDS` には **Web クライアント ID** を入れる。モバイルは
`webClientId` を指定して ID トークンを取得するため、`aud` は Web クライアント ID になる。

## 3つの経路

```text
ブラウザ（管理画面）
  -> Cloudflare Access（Google IdP）※ workout-habit-admin のホストに適用
  -> Cf-Access-Jwt-Assertion ヘッダ
  -> admin Worker が Service Binding で api Worker へ中継（ヘッダはそのまま）
  -> api Worker が team domain / AUD / 署名を再検証
  -> email からユーザーとロールを解決

モバイルアプリ
  -> Google サインインで ID トークンを取得（保存せず、必要な時点で取り直す）
  -> Authorization: Bearer <ID トークン>
  -> Worker が Google の JWKS で署名・aud・iss を検証
  -> google_sub / email からユーザーとロールを解決

Claude Code（CLI）
  -> Authorization: Bearer whk_...
  -> Worker が SHA-256 ハッシュで api_tokens を引く
  -> user_id からユーザーとロールを解決
```

経路ごとに違うのは検証方法だけで、その先は同じ「ユーザー ID + ロール」に着地する。

モバイルは `@react-native-google-signin/google-signin`（2026-08-07 に導入を決定）。
Expo 公式ガイドは `react-native-nitro-google-signin` も併記しているが、
iOS 先行の現状では Android Credential Manager の利点が効かず、依存の少なさと情報量で前者を選んだ。
**Android を本格展開する際は Credential Manager への移行を検討する。**

**ID トークンを端末に保存しない。** 有効期限が1時間しかなく、保存は盗まれる場所を増やすだけ。
ログイン状態はネイティブ SDK が持ち、送信のたびに `signInSilently()` から取り直す。

## 必要な Secret

すべて `wrangler secret put`（`apps/api/` を作業ディレクトリにして実行）。
未設定の経路は使えない（fail closed）。

| Secret | 用途 |
|---|---|
| `ACCESS_TEAM_DOMAIN` | Access のチームドメイン。`https://<domain>/cdn-cgi/access/certs` を JWKS に使う |
| `ACCESS_AUD` | Access アプリケーションの AUD タグ |
| `GOOGLE_CLIENT_IDS` | Google OAuth クライアント ID（iOS 用・Web 用をカンマ区切り） |

`API_TOKEN` と `ALLOWED_ORIGINS` は旧経路の Secret で、現在のコードは参照していない。

## ロール

| ロール | 対象 | できること |
|---|---|---|
| `admin` | 本人 | 全機能。CLI トークンの発行。**分析 API は admin でも本人の記録だけ**（下記） |
| `member` | 一般ユーザー | 自分の記録の入力（モバイル）、成長推移の閲覧、AI による次回計画立案 |

ロール判定は `src/middleware/authorize.ts` の `requireRole` に集約する。route へ散らさない。

`/backup` `/plans` `/analytics/*` は**ロールに関わらず常に本人のデータだけ**を対象にする。
かつて admin を無制限にしていたが、member が加わった瞬間に「先月の総ボリューム」が
他人の分を含む数字になり、分析として意味を失うため 2026-08-11 にやめた。
他人の記録を見る必要が出たら、既定で混ぜず明示的な指定（`?userId=`）を足す。

## 登録と有効化

当面は**招待制**。`users` に `status='invited'` で email を先に登録し、
初回ログインで `active` へ切り替わる（Google 経路ではこのとき `google_sub` を書き込む）。

CLI トークン経路は招待の有効化に使わない。`active` なユーザーにしか発行しない。

`status='disabled'` は即座に 403。アカウントを消さずに止められる。

## 所有者ユーザーの初期設定

`migrations/0002_multi_user_schema.sql` は既存データの所有者として `usr-owner` を作るが、
許可メールアドレスを公開リポジトリへ書かないため、email はプレースホルダにしてある。
**適用後に本人のアドレスへ更新するまで、この行では認証を通れない。**

```bash
# apps/api/ で実行。メールアドレスは履歴に残さないよう扱う
npx wrangler d1 execute workout-habit-db --remote \
  --command "UPDATE users SET email = '<本人のGoogleアカウント>' WHERE id = 'usr-owner'"
```

## 未確定事項

- `member` に開放する管理画面の区画の範囲
- ユーザー登録の入口（招待制の運用手順。管理画面から招待できるようにするか）
- AI 計画立案のモデル選定とレート制限

## 実装時の不変条件

以下は方式が変わっても守る。

- 設定不足（Secret 未設定・JWKS 取得失敗）のときは fail closed にする。認証をスキップしない
- 開発時に検証をスキップする抜け道を作らない
- ハッシュ済みトークンの照合は SQL の完全一致で行う（行が返った時点で一致は確定している）
- 認証後のユーザー ID を、リクエストごとのコンテキストで持ち回る。モジュールスコープへ置かない
- `/backup` と `/analytics/*` は、**ロールに関わらず**認証済みユーザー自身のデータだけを対象にする
  （admin も例外ではない。他人の記録が既定で混ざると分析の数字が意味を失うため）
- 認証失敗は 401、認可失敗は 403。どのチェックで落ちたかをレスポンスに書かない
