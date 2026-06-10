# workout-habit web — 開発ガイド

筋トレ記録の **読み取り専用・分析ダッシュボード**（Phase 4）。データ入力はモバイルアプリが担い、
本アプリは Phase 3 の分析API（`GET /analytics/*`）から集計済みデータを取得して描画する。
集計ロジックは API 側に一元化し、クライアントは表示整形（空週の穴埋め・フォーマット）のみ行う。
書き込み系の機能は持たない。

## 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| ビルド | Vite 7 | |
| UI | React 19 / TypeScript（strict） | |
| グラフ | 自作 SVG コンポーネント | 外部チャートライブラリは未導入（モバイルの TrendChart と同方針） |
| データ取得 | `GET /analytics/*`（apps/api） | Bearer トークンは localStorage に保存 |
| 配信 | apps/api Worker の static assets | 同一オリジンのため CORS 不要 |

外部ライブラリの新規導入は方針判断が必要なため、勝手に追加しない。

## ディレクトリ構成

```
src/
  types/        api.ts（/analytics レスポンス型。apps/api 側の JSON と対応）
  hooks/        useApiData（トークンContext＋パス単位の取得フック）
  utils/        datetime / number（表示整形の純粋関数のみ。集計はAPI側）
  components/   LineChart / BarChart / CalendarHeatmap / Section / Loadable
  sections/     ダッシュボードの各区画（1区画=1ファイル。各自が /analytics を取得）
  api.ts        apiGet とトークン・設定の localStorage 管理
  App.tsx       トークン設定 → ApiContext 提供 → セクション描画の薄いシェル
```

コーディング規約はモバイル側 `apps/mobile/.claude/rules/` の code-design / typescript に準じる
（神ファイル禁止・`any` 禁止・1文字変数禁止・行→ドメイン変換の集約など）。

## 開発コマンド

```bash
npm run dev        # vite dev（/backup は本番 API へプロキシ）
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + vite build → dist/
```

デプロイは apps/api 側の `npm run deploy`（web のビルド → wrangler deploy）で行う。
