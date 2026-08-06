---
paths: "apps/mobile/src/db/**/*.ts"
---
# データ永続化ルール（expo-sqlite）

**端末内 SQLite が正データ**。アプリはオフラインで完結して動作し、
クラウド（D1）は `db/sync.ts` 経由の任意バックアップとして扱う。

つまりオフライン**優先**であって、オフライン**専用**ではない。
ネットワークが無い状態で記録・閲覧・タイマーがすべて動くことを常に維持する。

## スキーマの集約
- テーブル DDL は `src/db/schema.ts` の `SCHEMA_SQL` に集約する。各所に散らさない
- 現在のテーブル: `body_parts` `exercises` `workouts` `workout_exercises` `workout_sets`
  `timer_events` `templates` `template_exercises` `app_settings` `body_logs`
- カラム名は snake_case。`created_at` / `updated_at` を持たせ、主キーは文字列ID（`newId()` で発番）
- `CREATE TABLE IF NOT EXISTS` で冪等に保つ。起動のたび再実行しても既存データを壊さない

## DB行型とドメイン型の分離
- SQLite から返る行型（snake_case・nullable）は `types/db.ts`、UIで使うドメイン型は `types/domain.ts`
- 変換は `db/mappers.ts` の `toBodyPart` / `toExercise` / `toWorkout` 等に集約する
  （詳細は [typescript.md](typescript.md) の「DB行型とドメイン型を分離する」）

## クエリ
- `SELECT *` は避け、必要カラムを明示する（行型とのズレを防ぐ）
- パラメータは必ずプレースホルダ（`?`）でバインドする。文字列結合で SQL を組み立てない
- 複数行の書き込み・関連する複数テーブル更新は **トランザクション**（`withTransactionAsync`）でまとめる
- N+1 を避ける。関連データは JOIN か `IN (...)` でまとめて取得する

## マイグレーション
`db/migrations.ts` の `MIGRATIONS` と `PRAGMA user_version` で管理する。
起動時に `runMigrations(database)` が未適用分を version 昇順で当てる。

- 変更は `MIGRATIONS` の末尾へ version を1つ進めたエントリを足す。**既存エントリを書き換えない**
  （適用済み端末には二度と実行されないため）
- `statements` には `ALTER TABLE` / `CREATE INDEX` など「既存DBへ差分を当てる」SQL を書く
- 新規インストールにも同じ結果になるよう、テーブル定義の変更は `schema.ts` にも反映する
- 破壊的変更（カラム削除・型変更・制約追加）は、SQLite に `ALTER TABLE ADD CONSTRAINT` が無いため
  「新テーブル作成 → 複製 → 削除 → リネーム」の再構築になる。段階適用にし、複数の変更を1回にまとめる
- **既存データを壊さないこと**（このアプリのデータはユーザーのトレーニング記録＝代替不能）
- スキーマを変えたら `apps/api/migrations/` と `apps/api/src/tables.ts`、`db/sync.ts` の
  `SYNC_TABLES` も同じ変更セットで直す
- `PRAGMA foreign_keys = ON` は接続時に有効化している。外部キーを定義すれば即座に効く

## シードの冪等化
- マスタ（部位・種目）の初期投入は `db/seed.ts` に置き、
  何度実行しても重複しないよう `INSERT OR IGNORE` か存在チェックを入れる

## 同期（db/sync.ts）
- 同期対象は `SYNC_TABLES` の定義がすべて。`app_settings` は端末ローカル設定
  （タイマー設定・同期トークン）のため対象外にする
- `applyBackupPayload` は端末側データを置き換える。**取り込み前に確認を挟む**
- `SYNC_TABLES` は `apps/api/src/tables.ts` と対になる。片方だけ変えない
- 通信の詳細は [auth.md](auth.md)

## エラー処理
- DB 操作の失敗は無言で握りつぶさない。操作名を文脈に付けて throw する
  （[code-design.md](code-design.md) §7・§8）
