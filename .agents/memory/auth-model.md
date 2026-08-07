# 認証モデル

Step 4 で実装中。**API 側（認証・認可・スコープ）は実装済み**、モバイル / 管理画面のクライアント側は未着手。

設計の詳細（認証・認可・スコープの分離、`users` テーブル、登録ポリシー、
守れること・守れないこと）は `docs/10_プロダクト設計/認証認可の設計.md` にある。実装前に読む。

## 実装状況

| 段 | 内容 | 実装 |
|---|---|---|
| 認証 | Access JWT / Google ID トークン / CLI トークンの検証 | 済（`src/auth/`） |
| 認可 | `users` を引き、登録が無ければ 403 | 済（`src/auth/users.ts`） |
| スコープ | `user_id` で行を絞る | 済（`src/db/scope.ts`） |
| モバイルのログイン | Google サインイン導入 | **未** |
| 管理画面 | Cloudflare Access の適用 | **未** |

クライアント側が未対応のため、**現在の API はモバイル / 管理画面の既存実装からは 401 になる**。
旧来の単一 Bearer トークン（`API_TOKEN`）の経路は削除済み。

## 3つの経路

```text
ブラウザ（管理画面）
  -> Cloudflare Access（Google IdP）
  -> Cf-Access-Jwt-Assertion ヘッダ
  -> Worker が team domain / AUD / 署名を再検証
  -> email からユーザーとロールを解決

モバイルアプリ
  -> Google サインインで ID トークンを取得（expo-secure-store へ保存）
  -> Authorization: Bearer <ID トークン>
  -> Worker が Google の JWKS で署名・aud・iss を検証
  -> google_sub / email からユーザーとロールを解決

Claude Code（CLI）
  -> Authorization: Bearer whk_...
  -> Worker が SHA-256 ハッシュで api_tokens を引く
  -> user_id からユーザーとロールを解決
```

経路ごとに違うのは検証方法だけで、その先は同じ「ユーザー ID + ロール」に着地する。

モバイルは当初 `expo-auth-session` を想定していたが、SDK 53 以降の iOS で
リダイレクトから戻れない不具合が報告されており、ネイティブ向けの現行推奨は
`@react-native-google-signin/google-signin`。development build 運用のため導入自体は可能だが、
外部ライブラリの新規導入にあたるため `apps/mobile/AGENTS.md` の方針に従って正式に判断する。

## 必要な Secret

すべて `wrangler secret put`（`apps/api/` を作業ディレクトリにして実行）。
未設定の経路は使えない（fail closed）。

| Secret | 用途 |
|---|---|
| `ACCESS_TEAM_DOMAIN` | Access のチームドメイン。`https://<domain>/cdn-cgi/access/certs` を JWKS に使う |
| `ACCESS_AUD` | Access アプリケーションの AUD タグ |
| `GOOGLE_CLIENT_IDS` | Google OAuth クライアント ID（iOS 用・Web 用をカンマ区切り） |
| `ALLOWED_ORIGINS` | CORS 許可オリジン（管理画面のオリジン） |

`API_TOKEN` は不要になった。新方式の動作確認後に削除する。

## ロール

| ロール | 対象 | できること |
|---|---|---|
| `admin` | 本人 | 全機能。分析 API は全ユーザー分を集計、CLI トークンの発行 |
| `member` | 一般ユーザー | 自分の記録の入力（モバイル）、成長推移の閲覧、AI による次回計画立案 |

ロール判定は `src/middleware/authorize.ts` の `requireRole` に集約する。route へ散らさない。

`/backup` は**ロールに関わらず常に本人のデータだけ**を対象にする。
admin が全件を見るのは分析 API の役割であり、全件を端末へ復元したり置き換えたりする経路は作らない。

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
- ローカル開発で検証を省略する場合、localhost 系のホスト名に限定する
- Secret の比較は通常の文字列比較ではなく Web Crypto による固定時間比較を使う
- 認証後のユーザー ID を、リクエストごとのコンテキストで持ち回る。モジュールスコープへ置かない
- `/backup` と `/analytics/*` は、認証済みユーザー自身のデータだけを対象にする（分析の admin を除く）
- 認証失敗は 401、認可失敗は 403。どのチェックで落ちたかをレスポンスに書かない
