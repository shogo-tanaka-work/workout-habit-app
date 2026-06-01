---
paths: "src/db/**/*.ts,**/*db*.ts"
---
# データ永続化ルール（expo-sqlite）

本アプリはオフライン完結。データはすべて端末内 SQLite（expo-sqlite）に保存する。
バックエンド・認証・ネットワーク同期は存在しない。

## スキーマの集約
- テーブル DDL（`CREATE TABLE ...`）は **`src/db/schema.ts` に集約**する。各所に散らさない
- 現在のテーブル群: `body_parts` `exercises` `workouts` `workout_exercises` `workout_sets`
  `timer_events` ほか（計8テーブル）。これらの DDL を `App.tsx` から `schema.ts` へ移す
- カラム名は snake_case。`created_at` / `updated_at` を持たせ、主キーは文字列ID（`newId()` で発番）

## DB行型とドメイン型の分離
- SQLite から返る行型（snake_case・nullable）は `types/db.ts`、UIで使うドメイン型は `types/domain.ts`
- 変換は `db/queries.ts` の `toBodyPart` / `toExercise` / `toWorkout` 等に集約する
  （詳細は [typescript.md](typescript.md) の「DB行型とドメイン型を分離する」）

## クエリ
- `SELECT *` は避け、必要カラムを明示する（行型とのズレを防ぐ）
- パラメータは必ずプレースホルダ（`?`）でバインドする。文字列結合で SQL を組み立てない
- 複数行の書き込み・関連する複数テーブル更新は **トランザクション**（`withTransactionAsync`）でまとめる
- N+1 を避ける。関連データは JOIN か `IN (...)` でまとめて取得する

## マイグレーション
- スキーマ変更は `PRAGMA user_version` でバージョン管理し、`migrations/` に世代ごとの差分を置く
- 破壊的変更（カラム削除・型変更）は段階的に行う
- 既存データを壊さないこと（このアプリのデータはユーザーのトレーニング記録＝代替不能）

## シードの冪等化
- マスタ（部位・種目）の初期投入は **何度実行しても重複しない**よう `INSERT OR IGNORE` か
  存在チェックを入れる（`App.tsx` の seed 処理を `db/seed.ts` へ移す際もこの性質を保つ）

## エラー処理
- DB 操作の失敗は無言で握りつぶさない。操作名を文脈に付けて throw する
  （[code-design.md](code-design.md) §7・§8）
