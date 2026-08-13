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
- `.agents/DESIGN.md` — UI を変更するとき（ビジュアルの正本）

## 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| ビルド | Vite 7 | |
| UI | React 19 / TypeScript（strict） | |
| グラフ | 自作 SVG コンポーネント | 外部チャートライブラリは未導入（モバイルの TrendChart と同方針） |
| 認証 | Cloudflare Access（Google IdP） | このホストの入口で止める。画面はログイン UI もトークンも持たない |
| データ取得 | `GET /api/*`（analytics / plans / me） | **同一オリジン**。配信元 Worker が API Worker へ中継する |
| 配信 | `workout-habit-admin` Worker（`worker/index.ts` + dist） | 静的配信と `/api/*` の中継のみ。集計も認可もしない |

外部ライブラリの新規導入は方針判断が必要なため、勝手に追加しない。

## ディレクトリ構成

```
src/
  types/        api.ts（API レスポンス型。apps/api 側の JSON と対応）
  hooks/        useApiData（セッション切れ通知の Context ＋ パス単位の取得フック）
  utils/        datetime / number（表示整形の純粋関数のみ。集計はAPI側）
  components/   LineChart / BarChart / CalendarHeatmap / Section / Loadable / Viewer
  sections/     ダッシュボードの各区画（1区画=1ファイル。各自が API を取得）
  api.ts        apiGet（同一オリジンの /api/*）と表示設定の localStorage 管理
  App.tsx       ApiContext 提供 → セクション描画の薄いシェル
  styles.css    CSS カスタムプロパティとクラス定義
  vite-env.d.ts vite/client の型参照のみ（import.meta.env は使っていない）
worker/
  index.ts      配信元 Worker。dist の配信と /api/* の中継だけを行う
wrangler.jsonc  workout-habit-admin Worker の設定（assets + API への Service Binding）
```

## なぜ API を中継するのか

Cloudflare Access は**ホスト単位**で守るため、Access が付ける `Cf-Access-Jwt-Assertion` は
このホスト宛のリクエストにしか付かない。画面から API Worker のオリジンを直接叩くと JWT が付かず、
かといって API 側にも Access を掛けると、未認証の XHR がログイン画面へのリダイレクトを受けて壊れる。

同一オリジンへ寄せればこの問題ごと消える。中継は Service Binding（Worker 間の直接呼び出し）で行い、
公開インターネットを経由しない。**API Worker は転送されたヘッダを信用せず、改めて JWT を検証する。**

## 開発コマンド

```bash
npm run dev        # vite dev
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + vite build → dist/
npm run deploy     # build → wrangler deploy（workout-habit-admin）
```

ビルド時の環境変数は無い（API は同一オリジンのため接続先の指定が要らない）。

**`npm run dev` では `/api/*` が 404 になる。** 中継役の Worker が居ないため、
データを伴う確認はできない（レイアウトやスタイルの確認用と割り切る）。
通しで確認するときはデプロイ後の環境を使う。Access を通るので、
ブラウザで Google ログイン済みであればそのまま見える。

**Vite は `VITE_` で始まる変数をビルド成果物へ埋め込む。** 秘密値をそこへ置かない。
現在この画面は秘密値を一切持たない（認証は Access が担う）。
