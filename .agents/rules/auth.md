---
paths: "apps/api/src/**/*.ts,apps/mobile/src/db/sync.ts,apps/web/src/api.ts"
---
# 認証

ゴール像・Secret 一覧・実装状況は `.agents/memory/auth-model.md` を読む。

## 現状の実装（API 側）

認証（誰か）→ 認可（使ってよいか）→ スコープ（どの行を触れるか）の3段に分ける。
経路ごとに違うのは1段目だけで、2段目以降は共通のコードを通る。

| 段 | 置き場所 |
|---|---|
| 認証 | `src/auth/`（`access.ts` / `google.ts` / `apiToken.ts` と共通の `jwt.ts`） |
| 認可 | `src/auth/users.ts`（`users` に行が無ければ 403） |
| スコープ | `src/db/scope.ts`（`scopeForUser` / `scopeForExercise`） |
| 経路の振り分け | `src/middleware/authenticate.ts` |
| ロール判定 | `src/middleware/authorize.ts`（`requireRole`） |

クライアント側（モバイルの Google サインイン、管理画面の Access 適用）は未着手。

## 変更時に守る不変条件

方式が変わっても以下は崩さない。

- 設定不足（Secret 未設定、JWKS 取得失敗）のときは **fail closed**。認証をスキップするフォールバックを書かない
- 認証を要しないパスは `authenticate.ts` の `PUBLIC_PATHS` へ明示的に足す。「特定パスだけ弾く」形にしない
- ローカル開発で検証を省略する場合、localhost 系のホスト名に限定する
- トークン比較は Web Crypto による固定時間比較を使う
- 認証済みユーザーはリクエストコンテキストで持ち回る。モジュールスコープへ置かない
- 認証失敗は `401`、認可失敗は `403`。理由を詳細に漏らさない（「どのチェックで落ちたか」をレスポンスに書かない）
- トークン・メールアドレス・`sub` をログへ出さない
- ロール判定を各 route に書かない。`requireRole` に集約する

## スコープの適用

**新しいエンドポイントを足すときは、必ず `src/db/scope.ts` の条件を通す。**
`WHERE user_id = ?` を route へ直接書かない。書き忘れた瞬間に他人のデータが漏れる。

- 記録テーブル: `scopeForUser(user, 'w.user_id')`。member は自分の行、admin は全件
- 種目マスタ: `scopeForExercise(user, 'e.owner_user_id')`。
  `owner_user_id IS NULL` は全ユーザー共有のプリセット
- `/backup` はロールに関わらず本人スコープ。admin でも他人の行を復元・置換させない
- 列名は呼び出し側のリテラルだけを渡す。外部入力を列名に使わない

## 残作業（Step 4）

- モバイル: Google サインイン導入、ID トークンの取得と `expo-secure-store` への保存
- 管理画面: `workout-habit-admin` へ Cloudflare Access を適用し、トークン入力 UI を撤去
- `/backup` の全置換を操作ベース（intent）の CRUD へ移行する
