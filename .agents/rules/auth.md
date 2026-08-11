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

- 記録テーブル: `scopeForUser(user, 'w.user_id')`。**ロールに関わらず本人の行だけ**
- 種目マスタ: `scopeForExercise(user, 'e.owner_user_id')`。
  `owner_user_id IS NULL` は全ユーザー共有のプリセット。他人のカスタム種目は見えない
- `/backup` と `/plans` も本人スコープ。admin でも他人の行を復元・置換・閲覧させない
- 列名は呼び出し側のリテラルだけを渡す。外部入力を列名に使わない

### admin を無制限にしない（2026-08-11 決定）

かつて `scopeForUser` は admin へ `1 = 1` を返していた。ユーザーが1人の間は無害だが、
**member が加わった瞬間に分析が全員の合算になる。**
「先月の総ボリューム」が他人の分を含む数字になり、分析として意味を失う。

他人の記録を見る必要が出たら、**明示的な指定（`?userId=`）を足す**。
既定で混ざるのは事故でしかない。

## 書き込みの保証

member を受け入れる前提で `src/sync/apply.ts` を監査した結果（2026-08-11）。
新しい書き込み経路を足すときは、同じ保証が成り立つことを確かめる。

| 保証 | 実装 |
|---|---|
| 他人の行を書けない | `checkExistingOwner` が `row not found` で拒否する |
| 共有プリセットを書き換えられない | 同上（`owner_user_id IS NULL` は自分の行ではない） |
| 所有者を横取りできない | `buildUpsertStatement` の `WHERE ownerColumn = excluded.ownerColumn` |
| 削除も自分の行だけ | `DELETE ... AND ownerColumn = ?` |
| 共有プリセットの参照はできる | `parentIsUsable` が `owner === null` を許可する |

**拒否の理由は `row not found` で揃える。** 「他人の行だから」と返すと、
その ID の行が存在することを漏らしてしまう。

## 自分の情報

`GET /me`（`src/routes/me.ts`）が id / 表示名 / ロールを返す。
**ユーザー一覧の経路は作らない。** 引くのは常に自分の行だけ。

表示名は `display_name ?? email`。Access 経路のユーザーは JWT に名前が無く
`display_name` が埋まらないため、API 側でフォールバックまで済ませる。
