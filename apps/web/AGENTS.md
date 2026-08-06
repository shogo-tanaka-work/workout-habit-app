# workout-habit web — 開発ガイド

筋トレ記録の **読み取り専用・分析ダッシュボード**（管理画面）。データ入力はモバイルアプリが担い、
本アプリは分析API（`GET /analytics/*`）から集計済みデータを取得して描画する。
集計ロジックは API 側に一元化し、クライアントは表示整形（空週の穴埋め・フォーマット）のみ行う。
書き込み系の機能は持たない。

## 開発ルール

コーディング規約はリポジトリルートの `.agents/` に集約している。実装前に読む。

- `.agents/AGENTS.md` — 入口。3アプリの責務境界とルール読み込み順
- `.agents/rules/web-react.md` — 責務境界・データ取得・レイアウト・グラフ
- `.agents/rules/code-design.md`、`typescript.md`、`project-structure.md` — 全アプリ共通
- `.agents/DESIGN.md` と `.agents/rules/ui-design.md` — UI を変更するとき

## 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| ビルド | Vite 7 | |
| UI | React 19 / TypeScript（strict） | |
| グラフ | 自作 SVG コンポーネント | 外部チャートライブラリは未導入（モバイルの TrendChart と同方針） |
| データ取得 | `GET /analytics/*`（apps/api） | Bearer トークンは localStorage に保存（Step 4 で Cloudflare Access へ移行予定） |
| 配信 | `workout-habit-admin` Worker（静的アセットのみ） | Step 4 で Cloudflare Access をホストまるごとに適用する |
| API 接続先 | ビルド時の `VITE_API_ORIGIN` | **別オリジン**。API 側の CORS 許可が必要 |

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
  styles.css    CSS カスタムプロパティとクラス定義
  vite-env.d.ts import.meta.env の型定義
wrangler.jsonc  workout-habit-admin Worker の設定（静的アセットのみ）
env.example     VITE_API_ORIGIN のテンプレート
```

## 開発コマンド

```bash
npm run dev        # vite dev
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + vite build → dist/
npm run deploy     # build → wrangler deploy（workout-habit-admin）
```

`env.example` を `.env.local` へコピーし、`VITE_API_ORIGIN` に API Worker のオリジンを設定する。
**開発でも本番ビルドでも同じ値が使われる**（プロキシは使わず、常に絶対 URL + CORS を通る）。
未設定のままビルドすると、画面が設定漏れのメッセージを表示する。`.env.local` はコミットしない。

**API トークンを `.env.local` や `env.example` へ書かない。** Vite は `VITE_` で始まる変数を
ビルド成果物へ埋め込むため、書けば配信される JS から読めてしまう。
ブラウザ用トークンは画面の入力欄から設定し、localStorage に保持する。
