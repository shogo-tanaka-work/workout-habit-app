---
paths: "**/*.ts,**/*.tsx"
---
# プロジェクト構成ルール

3アプリとも「責務ごとのディレクトリ」で分割する。[code-design.md](code-design.md) §1 の具体化。

**ディレクトリの中身そのものは各アプリの `AGENTS.md` を正本とする。**
ここに構成図を再掲しない（同じ図が2箇所にあると、必ず片方だけ古くなる）。

- `apps/mobile/AGENTS.md`
- `apps/api/AGENTS.md`
- `apps/web/AGENTS.md`

このファイルが決めるのは「何をどこへ置くか」「どちらからどちらへ依存してよいか」だけ。

## アプリをまたがない

アプリ間で直接 import しない。共有したい定義は各アプリに重複させ、
対になるファイルを同じ変更セットで直す（[code-design.md](code-design.md) §10）。

## apps/mobile の置き場

| 置くもの | 行き先 |
|---|---|
| 型定義（interface / type / union） | `types/` |
| SQL・テーブル定義・CRUD・行→ドメイン変換 | `db/` |
| 送信キューと同期の実務 | `db/outbox.ts`（キュー） / `db/sync.ts`（取り込み） / `sync/pusher.ts`（送信） |
| Google サインインと ID トークンの調達 | `auth/` |
| ローカル通知の登録・取り消し | `notifications/` |
| `use` で始まる状態/副作用ロジック | `hooks/` |
| 副作用のない純粋関数（整形・計算） | `utils/` |
| 複数画面で使う表示部品 | `components/` |
| タブ画面・オーバーレイ画面・設定のサブ画面 | `screens/` |
| StyleSheet・テーマ定数 | `styles/` |

`screens/` はタブと1対1ではない。次の3種類が入る。

- タブ画面（`HomeScreen` / `WorkoutScreen` / `HistoryScreen` / `SettingsScreen`）
- タブの上へ全面でかぶせるオーバーレイ画面（`ExerciseDetailScreen` / `WorkoutEditScreen`）
- 設定タブから開くサブ画面（`ExerciseListScreen` / `TimerSettingsScreen` / `CsvExportScreen`）

依存方向:

- `types/` `utils/` は他に依存しない（最下層・純粋）
- `db/` `auth/` `notifications/` は `types/` `utils/` に依存してよい
- `sync/` は `db/` `auth/` に依存してよい
- `hooks/` は上記すべてに依存してよい
- `components/` `screens/` は上記すべてに依存してよいが、`screens/` 同士は依存しない
- 逆方向（`utils/` が `components/` を import 等）は禁止

`App.tsx` はシェルに保つ。DB 初期化、タブ切替、オーバーレイの出し分け、
画面をまたぐ状態（編集中の記録 ID など）だけを持ち、ドメインの計算を書かない。

## apps/api の置き場

| 置くもの | 行き先 |
|---|---|
| Hono アプリ本体・ミドルウェアの積み方・route のマウント | `index.ts` |
| ドメイン単位の route | `routes/`（`sync` / `plans` / `me` / `apiTokens`） |
| 集計エンドポイント | `analytics.ts` |
| バックアップ / 復元 | `backup.ts` |
| 認証の実装（JWT 検証・Google・API トークン・ユーザー解決） | `auth/` |
| 横断関心（認証の振り分け・ロール判定） | `middleware/` |
| 行スコープの条件生成 | `db/scope.ts` |
| 同期の形式検証と冪等な適用 | `sync/`（`validate` / `apply`） |
| 同期対象エンティティの定義（列の型・親参照） | `tables.ts` |

route を追加するときは `routes/` へ置く。`analytics.ts` と `backup.ts` が
トップレベルにあるのは分割前からの経緯で、新しく倣う形ではない。

**SQL を route へ散らさない。** 行スコープの条件は `db/scope.ts` の
`scopeForUser` / `scopeForExercise` を通す（[auth.md](auth.md)）。

## apps/web の置き場

| 置くもの | 行き先 |
|---|---|
| API レスポンス型（apps/api の JSON と対応） | `types/api.ts` |
| 取得フックとセッション切れの通知 | `hooks/useApiData.ts` |
| 表示整形の純粋関数（集計はしない） | `utils/` |
| グラフ・枠・状態表示の部品 | `components/` |
| ダッシュボードの各区画（1区画=1ファイル） | `sections/` |
| `apiGet` と表示設定の localStorage | `api.ts` |
| 静的配信と `/api/*` の中継 | `worker/index.ts` |

`sections/` に集計ロジックを書かない。集計は API 側に一元化する。

## バレルエクスポートを避ける

`index.ts` での再エクスポート集約は、React Native の Fast Refresh を壊しやすく循環参照も招く。
各モジュールから直接 import する。
