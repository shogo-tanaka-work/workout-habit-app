---
paths: "apps/mobile/src/db/**/*.ts,apps/mobile/src/sync/**/*.ts"
---
# データ永続化ルール（expo-sqlite）

**正データは D1（サーバ）**。端末内 SQLite は表示用キャッシュ＋操作キュー（outbox）として扱う。
決定の経緯は `docs/10_プロダクト設計/同期アーキテクチャの設計.md`。

ただしオフライン**優先**は維持する。ネットワークが無い状態で記録・閲覧・タイマーが
すべて動くことを崩さない。書き込み経路は常に1本で、切り替わるのは送信タイミングだけ。

```
[記録操作] → ローカルへ即時反映 ＋ 操作をキューへ積む（1トランザクション）
                          ↓
              送信役（src/sync/pusher.ts）が契機ごとに送る
```

- **書き込みは必ず `db/queries.ts` の `writeWithOutbox` を通す。**
  通さない書き込みを増やすと、その変更はキューに乗らず端末にしか残らない
- 送信の契機は「その種目の全セット完了」。補助的にワークアウト完了・
  アプリのバックグラウンド遷移／復帰・「今すぐ同期」ボタン
- ユーザーへ「機内モード」のような概念は見せない。出すのは `未送信 N件` の控えめな表示だけ。
  現在の置き場は設定タブ →「クラウド同期」画面（`components/CloudSyncSection.tsx`）

## スキーマの集約
- テーブル DDL は `src/db/schema.ts` の `SCHEMA_SQL` に集約する。各所に散らさない
- 現在のテーブルは15個: `body_parts` `exercises` `user_exercise_settings` `workouts`
  `workout_exercises` `workout_sets` `timer_events` `templates` `template_exercises`
  `app_settings` `body_logs` `sync_outbox` `weekly_feedback` `exercise_goals`
  `training_phases`
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
- スキーマを変えたら、次をすべて同じ変更セットで直す。
  `apps/api/migrations/`（D1 の DDL）/ `apps/api/src/tables.ts` の `SYNC_TABLES` /
  `db/syncTables.ts` の `SYNC_COLUMNS` / `db/migrations.ts`（端末の段階適用）/
  必要なら `db/seed.ts`
- `PRAGMA foreign_keys = ON` は接続時に有効化している。外部キーを定義すれば即座に効く

## シードの冪等化
- マスタ（部位・種目）の初期投入は `db/seed.ts` に置き、
  何度実行しても重複しないよう `INSERT OR IGNORE` か存在チェックを入れる
- **共有プリセット種目は D1 の migrations に入っていない。** サーバ側は CSV 投入や
  手動 SQL で維持しており、端末側の正本が `seedExercises`。種目を増やすときは
  `seed.ts` と D1 の `exercises`（`owner_user_id IS NULL`）の両方へ入れる。
  片方だけだと、同期のたびに端末とサーバで種目数が食い違う

## 同期

| ファイル | 役割 |
|---|---|
| `db/queries.ts` | 同期対象テーブルへの書き込み。**write の中で enqueue する** |
| `db/appSettings.ts` | 端末ローカルの設定。同期対象外なので enqueue しない |
| `db/loadWorkoutData.ts` | 画面が使うデータの一括読み取り |
| `db/syncTables.ts` | 同期対象エンティティと列の定義。`apps/api/src/tables.ts` と対になる |
| `db/outbox.ts` | 操作キューの出し入れ。`sync_outbox` テーブル |
| `sync/pusher.ts` | 送信役。`POST /sync/operations` へ送り、確定した操作を取り下げる |
| `db/sync.ts` | サーバの内容で端末を作り直す取り込み（機種変更・再インストール向け） |
| `db/plans.ts` | 予定（`status='planned'`）の取り込み。`GET /plans` の期間をまるごと置き換える |

- `app_settings` と `sync_outbox` は端末ローカルのため同期対象外。
  `app_settings` のキーは接続先（`sync_api_url` / `sync_last_backup_at` / `sync_paused`）、
  タイマーの通知設定（`timer_sound_enabled` / `timer_vibration_enabled`）、
  共通タイマーのプリセット（`timer_rest_presets`、JSON 配列）、
  実行中の休憩タイマー（`rest_timer`）。
  `body_parts` は共有マスタで seed が持つため同期しない
- `enqueueUpsert` は同じ行の未送信 upsert があれば payload を差し替える。
  **並び順は据え置く**（積み直すと親より子が先に送られ、サーバで弾かれる）
- 親を消したときは親の `delete` だけを積む。子はサーバ側の外部キーで消える
- プリセット種目は全ユーザー共有のためサーバでは書き換えられない。
  `exercises` を直接更新してよいのはカスタム種目（`exercise-` 始まりの ID）だけ。
  **プリセットの設定変更は `user_exercise_settings` へ書く**（休憩・バー重量・非表示）。
  名前と部位は上書きの対象にしない
- 上書きの実効値は `loadWorkoutData` が畳み込んでから配る。
  画面ごとに合成すると必ずどこかで忘れる。`NULL` は「上書きしない」
- 種目は**アーカイブ済みも読み込む**。除外すると戻す手段が無くなり、
  過去の記録から種目名も引けなくなる。選択肢に出すかどうかは表示側で絞る
- `applyBackupPayload` は端末側データを置き換え、**送信待ちの操作を破棄する**。
  取り込み前に確認を挟む
- 一時停止（`app_settings` の `sync_paused`）が止めるのは**自動の送受信だけ**。
  記録の保存も、手動の「今すぐ同期」「予定を取り込む」も止めない。
  手動まで止めると、送り忘れた分が端末にしか存在しない状態を自分で作ることになる
- 未送信が残っている間は定期的に再送する（60秒間隔）。他の契機はどれも操作か画面遷移が要るため、
  **アプリを開いたまま通信が一時的に失敗すると次に画面を離れるまで送信されない**。
  未送信が 0 になればタイマーは張り直さない（常駐させない）
- **受信は outbox へ積まない。** サーバから来た内容を送り返すことになり、更新時刻だけが無意味に進む。
  `writeWithOutbox` を通す書き込みは「端末で起きた操作」に限る
- 予定の取り込みは `planned` の行しか消さない。実績（`active` / `completed`）に触れると記録が消える。
  同じ ID の予定を端末が先に開始していたら**取り込まない**（進行中の記録を予定で上書きしないため）
- `SYNC_COLUMNS` は `apps/api/src/tables.ts` と対になる。片方だけ変えない
- 通信の詳細は [auth.md](auth.md)

## エラー処理
- DB 操作の失敗は無言で握りつぶさない。操作名を文脈に付けて throw する
  （[error-handling.md](error-handling.md)）
