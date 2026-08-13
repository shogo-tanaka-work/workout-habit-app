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

クライアント側も実装済み。モバイルは `apps/mobile/src/auth/googleAuth.ts` が
ID トークンを都度取得し（端末に保存しない）、管理画面は Cloudflare Access の
セッションに依存してトークンを一切持たない。

## 変更時に守る不変条件

方式が変わっても以下は崩さない。

- 設定不足（Secret 未設定、JWKS 取得失敗）のときは **fail closed**。認証をスキップするフォールバックを書かない
- 認証を要しないパスは `authenticate.ts` の `PUBLIC_PATHS` へ明示的に足す。「特定パスだけ弾く」形にしない
- 開発時に検証をスキップする抜け道を作らない（現状そのような分岐は無い）
- ハッシュ済みトークンの照合は SQL の完全一致で行う。
  D1 から行が返った時点で一致は確定しているため、その後の再比較は要らない
- 認証済みユーザーはリクエストコンテキストで持ち回る。モジュールスコープへ置かない
- 認証失敗は `401`、認可失敗は `403`。理由を詳細に漏らさない（「どのチェックで落ちたか」をレスポンスに書かない）
- トークン・メールアドレス・`sub` をログへ出さない
- ロール判定を各ハンドラに書かない。`requireRole` を router の先頭で積む
  （`apiTokens.use('*', requireRole('admin'))`）
- **認証の副作用（`last_used_at` の更新、プロフィールの補完）が失敗しても認証は落とさない。**
  記録できないことと、本人でないことは別問題

## スコープの適用

**route の SQL は必ず `src/db/scope.ts` の条件を通す。**
`WHERE user_id = ?` を route へ直接書かない。書き忘れた瞬間に他人のデータが漏れる。
（`sync/apply.ts` のように呼び出し元から `userId` を受け取る内部ヘルパは対象外。
route の時点でスコープが閉じている）

- 記録テーブル: `scopeForUser(user, 'w.user_id')`。**ロールに関わらず本人の行だけ**
- 種目マスタ: `scopeForExercise(user, 'e.owner_user_id')`。
  `owner_user_id IS NULL` は全ユーザー共有のプリセット。他人のカスタム種目は見えない
- `/backup` `/plans` `/admin/api-tokens` も本人スコープ。admin でも他人の行を復元・置換・閲覧させない
- **`/backup` の削除では `scopeForExercise` を使わない。** `owner_user_id IS NULL` を含むため、
  全ユーザー共有のプリセット種目まで消える。削除は `scopeForUser` で本人の行に限る
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

`GET /me`（`src/routes/me.ts`）が `id` / `role` / `status` / `email` / `displayName` を返す。
**ユーザー一覧の経路は作らない。** 引くのは常に自分の行だけ。

表示名は `display_name ?? email`。Access 経路のユーザーは JWT に名前が無く
`display_name` が埋まらないため、API 側でフォールバックまで済ませる。

## ユーザーの解決と状態

`src/auth/users.ts` が認証結果から `users` の行を引く。ここも不変条件がある。

- **紐付けの主キーは `google_sub`。** ただし招待した時点では sub が未知のため、
  `google_sub` → `email` の順で引き、初回ログインで sub を書き込む
- `status` は `invited` / `active` / `disabled` の3値。
  `invited` は初回ログインで `active` へ自動昇格し、`disabled` は常に拒否する
- 行が無ければ 403。**認証できたことと、使ってよいことは別**
