---
paths: "apps/api/src/**/*.ts"
---
# Hono API

- Route は入力の取得・検証、ロジック呼び出し、HTTP レスポンス変換だけを行う
- エラー形式は `{ error: string }` へ統一する。詳細を返す場合は `{ error: string, details?: unknown }`
- 400、401、404、409、422、500 を用途に応じて使い分ける
- URL パラメータと JSON body を未検証のまま処理へ渡さない
- 検証は route 層で行い、その先は検証済みの型付き入力だけを受け取る
- Hono のサブ Router をドメイン単位で構成する。新しい route は `src/routes/` へ置く
  （`analytics.ts` と `backup.ts` がトップレベルにあるのは分割前からの経緯で、倣う形ではない）
- ロール制限は router の先頭で積む（`apiTokens.use('*', requireRole('admin'))`）。
  ハンドラごとに判定を書かない
- **CORS は持たない。** 管理画面は `workout-habit-admin` からの Service Binding 中継で
  同一オリジンになり、モバイルと Claude Code はブラウザ経由ではない。
  CORS が要る状況になったら、その前に経路の設計を疑う

## 集計エンドポイント（/analytics/*）

- 集計ロジックの正本はここ。クライアント側に同じ計算を置かない
- **ウォームアップ（`is_warmup = 1`）は集計に入れない。** UI で WU を指定できるのに
  総ボリュームへ算入されると、軽い準備セットを足すほど数字が実態から離れる。
  セットを数える SQL には `s.deleted_at IS NULL AND s.is_warmup = 0` を必ず添える。
  モバイル側 `utils/aggregate.ts` と同じ規則。片方だけ変えない
- レスポンス形状を変えたら `apps/web/src/types/api.ts` を同じ変更セットで直す
- 日付はモバイルが端末ローカル日付（`YYYY-MM-DD`）で保存するため、
  基準日はクライアントから `?today=YYYY-MM-DD` で受け取る。サーバの UTC 今日を暗黙の基準にしない
- クエリパラメータの数値は `clampInt` のような上下限つき変換を通す。生の `Number()` を使わない
- 週の定義（月曜はじまり）など、モバイルと共通の計算規則は定数に名前を付ける
- **推定1RM の除数は種目で変わる。** BIG3 は FWJ の RM換算表（ベンチ ÷40、
  スクワット・デッドリフト ÷33.3）、それ以外は Epley（÷30）。`rmDivisorSql()` の CASE で切り替える。
  モバイル側の正本は `apps/mobile/src/utils/oneRepMax.ts`。**片方だけ変えない**

## /sync/operations（操作ベースの同期）

- 送られるのはスナップショットではなく操作（intent）。`upsert` / `delete` の2種類
- エンティティ名と列は `src/tables.ts` の定義を許可リストとする。未知の列は通さない
- 検証は `src/sync/validate.ts`、適用は `src/sync/apply.ts`。route に SQL を書かない
- 冪等性は `sync_operations` 台帳（`(user_id, id)` が主キー）で担保する。
  **操作 ID をユーザー横断の一意キーにしない**（他人が先に同じ ID を送ると適用を妨げられる）
- 競合は後勝ち。ただし手元の行の `updated_at` が新しければ適用せず `stale` を返す
- 対象行と親行の所有者を必ず確かめる。他人の行の存在は `row not found` で伏せる
- 1件が失敗しても残りは適用する（部分成功）。HTTP 400 は body 自体が不正なときだけ

## /plans（予定の配布）

- 返すのは `status='planned'` の行だけ。実績（`active` / `completed`）を混ぜない。
  端末は取り込んだ内容で期間を置き換えるため、実績が混ざると記録が消える
- **ロールに関わらず本人の予定だけを返す。** admin が全件を見るのは分析 API の役割
- 期間（`from` / `to`）は必須。サーバの UTC 今日を暗黙の基準にしない
- 差分（`?since=`）にしない。削除が物理削除で tombstone を持たず、差分では消えたことを表現できない

## /backup

- 本人の行だけを DELETE → INSERT で置き換える。**破壊的操作**であることを常に意識する
- 所有者の列はクライアントの値を使わず、認証済みユーザーの ID をサーバ側で埋める
- 読み出しは共有プリセット種目（`owner_user_id IS NULL`）も返す。返さないと端末で復元できない。
  一方 **削除では種目用スコープを使わない**（NULL 所有まで消えて全ユーザーのプリセットが飛ぶ）
- D1 のバインド変数上限（1クエリ 100）を超えないよう行チャンクに分ける
- 途中失敗時は次回バックアップ成功で回復する前提。この前提を変えるなら記録を残す

## /me・/admin/api-tokens

- `GET /me` が返すのは自分の `id` / `role` / `status` / `email` / `displayName`。
  ユーザー**一覧**の経路は作らない
- `/admin/api-tokens` は admin のみ。Claude Code 連携用のトークンを発行・一覧・失効する
- **平文のトークンは発行レスポンスでしか返さない。** D1 にはハッシュだけを保存する

## 入力の上限を定数で持つ

無指定の巨大な入力で D1 を舐めさせない。上限は名前を付けて1か所に置く。

| 定数 | 場所 | 値 |
|---|---|---|
| `MAX_OPERATIONS_PER_REQUEST` | `sync/validate.ts` | 200 |
| `MAX_RANGE_DAYS` | `routes/plans.ts` | 366 |
| `MAX_TOKEN_NAME_LENGTH` | `routes/apiTokens.ts` | 64 |
| `MAX_BOUND_PARAMS` / `MAX_STATEMENTS_PER_BATCH` | `backup.ts` | 90 / 80 |

## エンドポイント追加時の手順

1. `src/routes/` に route を追加する
2. 認証が必要かを明示的に判断する（`/health` 以外は認証必須が既定）
3. 行スコープを `src/db/scope.ts` の `scopeForUser` / `scopeForExercise` で組む。
   **route に `WHERE user_id = ?` を直接書かない**（[auth.md](auth.md)）
4. `apps/web` から使うなら `apps/web/src/types/api.ts` に型を追加する

この Worker は静的アセットを持たないため、パスの振り分け設定は不要。
管理画面は別 Worker（`workout-habit-admin`）が配信する。
