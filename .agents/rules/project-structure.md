---
paths: "**/*.ts,**/*.tsx"
---
# プロジェクト構成ルール

3アプリとも「責務ごとのディレクトリ」で分割する。[code-design.md](code-design.md) §1 の具体化。

## モノレポの構成

```
筋トレ習慣化アプリ/
  .agents/        規約・デザイン正本・構成メモ（このディレクトリ）
  apps/mobile/    Expo アプリ（入力）
  apps/api/       Hono on Workers（サーバ）
  apps/web/       Vite + React（管理画面）
  docs/           企画・設計・調査・発信素材・運用ログ（非公開）
```

アプリ間で直接 import しない。共有したい定義は各アプリに重複させ、
対になるファイルを同じ変更セットで直す（[code-design.md](code-design.md) §10）。

## apps/mobile

```
src/
  types/        domain.ts（ドメイン型）/ db.ts（SQLite 行型）
  db/           schema.ts（DDL）/ seed.ts / queries.ts（CRUD）/ mappers.ts（行→ドメイン変換）/ sync.ts（クラウド同期）
  hooks/        useWorkoutData / useRestTimer … 状態＋副作用ロジック
  utils/        datetime / format / number / aggregate / plates / calendar / csv / id … 純粋関数のみ
  components/   TimerBanner / SetEditor / SetTable / TrendChart … 再利用UI
  screens/      HomeScreen / WorkoutScreen / HistoryScreen / ExerciseScreen / ExerciseDetailScreen
  styles/       theme.ts（色・余白・フォント）/ appStyles.ts（共有 StyleSheet）
App.tsx         DB初期化・タブ切替のみの薄いシェル
```

| 置くもの | 行き先 |
|---|---|
| 型定義（interface / type / union） | `types/` |
| SQL・テーブル定義・CRUD・行→ドメイン変換・同期 | `db/` |
| `use` で始まる状態/副作用ロジック | `hooks/` |
| 副作用のない純粋関数（整形・計算） | `utils/` |
| 複数画面で使う表示部品 | `components/` |
| 1タブ＝1画面の構成部品 | `screens/` |
| StyleSheet・テーマ定数 | `styles/` |

依存方向:

- `utils/` `types/` は他に依存しない（最下層・純粋）
- `db/` は `types/` に依存してよい
- `hooks/` は `db/` `utils/` `types/` に依存してよい
- `components/` `screens/` は上記すべてに依存してよいが、`screens/` 同士は依存しない
- 逆方向（`utils/` が `components/` を import 等）は禁止

## apps/api

```
src/
  index.ts      Hono アプリ本体・認証ミドルウェア・/health・/backup
  analytics.ts  /analytics/* の集計エンドポイント
  tables.ts     同期対象テーブルとカラム定義
schema.sql      D1 のテーブル定義
wrangler.jsonc  Worker 設定（D1 binding・静的アセット）
```

現状は3ファイルだが、`index.ts` が 300 行を超えたら次の層へ分割する。

- `routes/` — HTTP 入出力のみ。SQL を直接書かない
- `services/` — ユースケースと集計
- `repositories/` — D1 クエリ
- `middleware/` — 認証など横断関心

分割するまでの間も、1ファイル内で「Route の定義」「検証」「集計」「SQL」を関数として分けておく。

## apps/web

```
src/
  types/        api.ts（/analytics レスポンス型。apps/api の JSON と対応）
  hooks/        useApiData（トークンContext＋パス単位の取得フック）
  utils/        datetime / number（表示整形の純粋関数のみ。集計はAPI側）
  components/   LineChart / BarChart / CalendarHeatmap / Section / Loadable
  sections/     ダッシュボードの各区画（1区画=1ファイル。各自が /analytics を取得）
  api.ts        apiGet とトークン・設定の localStorage 管理
  App.tsx       トークン設定 → ApiContext 提供 → セクション描画の薄いシェル
  styles.css    CSS カスタムプロパティとクラス定義
```

`sections/` に集計ロジックを書かない。集計は API 側に一元化する。

## バレルエクスポートを避ける

`index.ts` での再エクスポート集約は、React Native の Fast Refresh を壊しやすく循環参照も招く。
各モジュールから直接 import する。
