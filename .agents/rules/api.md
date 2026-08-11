---
paths: "apps/api/src/**/*.ts"
---
# Hono API

- Route は入力の取得・検証、ロジック呼び出し、HTTP レスポンス変換だけを行う
- エラー形式は `{ error: string }` へ統一する。詳細を返す場合は `{ error: string, details?: unknown }`
- 400、401、404、409、422、500 を用途に応じて使い分ける
- URL パラメータと JSON body を未検証のまま処理へ渡さない
- 検証は route 層で行い、その先は検証済みの型付き入力だけを受け取る
- Hono のサブ Router をドメイン単位で構成する（`/analytics` は `src/analytics.ts`）
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
- 週の定義（月曜はじまり）や Epley 係数など、モバイルと共通の計算規則は定数に名前を付ける。
  モバイル側の同名ロジック（`utils/aggregate.ts` など）と定義を揃える

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

- 全テーブルの DELETE → INSERT による全置換。**破壊的操作**であることを常に意識する
- D1 のバインド変数上限（1クエリ 100）を超えないよう行チャンクに分ける
- 途中失敗時は次回バックアップ成功で回復する前提。この前提を変えるなら記録を残す
- マルチユーザー化ではユーザースコープの置換に変える必要がある（[auth.md](auth.md)）

## エンドポイント追加時の手順

1. `src/` に route を追加する
2. 認証が必要かを明示的に判断する（`/health` 以外は認証必須が既定）
3. `apps/web` から使うなら `apps/web/src/types/api.ts` に型を追加する

この Worker は静的アセットを持たないため、パスの振り分け設定は不要。
管理画面は別 Worker（`workout-habit-admin`）が配信する。
