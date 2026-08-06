# workout-habit-app

筋トレの記録を、分析と習慣化につなげる個人開発プロダクトです。

記録はスマートフォンで、振り返りはブラウザで。という前提でアプリを3つに分けたモノレポ構成です。

## 構成

| ディレクトリ | 役割 | 技術 |
|---|---|---|
| `apps/mobile/` | 記録の入力。オフライン優先で、端末内 SQLite が正データ | Expo SDK 56 / React Native 0.85 / React 19 |
| `apps/api/` | D1 の所有者・認証境界・集計ロジックの正本・管理画面の配信元 | Hono / Cloudflare Workers / D1 |
| `apps/web/` | 読み取り専用の分析ダッシュボード | Vite / React 19 |

`apps/web` は独立してデプロイせず、`apps/api` の Worker から静的アセットとして同一オリジン配信します。

## 主な機能

- ワークアウトの記録（種目・セット・重量・レップ）とテンプレートからの開始
- レストタイマー（完了音つき）
- 種目マスタの管理、プレート計算、Epley 式による推定 1RM と RM 換算表
- 履歴のカレンダー表示、体重・体脂肪率のボディログ
- クラウドへの任意バックアップと復元
- ブラウザでの分析（週次・月次推移、部位別ボリューム、種目別推移、継続状況のヒートマップ）

グラフは外部チャートライブラリを使わず、自作の SVG コンポーネントで描画しています。

## セットアップ

前提: Node.js、Xcode（iOS ビルド用）、Cloudflare アカウント。

> **リポジトリは ASCII のみのパスへ置いてください。** 日本語などマルチバイト文字を含む
> ディレクトリ配下では、React Native のプリビルド取得が失敗して iOS ビルドが通りません。
> 詳細は `.agents/rules/mobile-react-native.md` を参照してください。

```bash
git clone git@github.com:shogo-tanaka-work/workout-habit-app.git
cd workout-habit-app
npm --prefix apps/mobile install
npm --prefix apps/api install
npm --prefix apps/web install
```

### モバイルアプリ

```bash
npm --prefix apps/mobile run ios     # 実機 / シミュレータで起動
npm --prefix apps/mobile run start   # Metro のみ起動
```

### API（Cloudflare Workers）

D1 データベースを作成し、`apps/api/wrangler.jsonc` の `database_id` を自分のものに差し替えます。

```bash
cd apps/api
npx wrangler d1 create workout-habit-db
npx wrangler d1 migrations apply workout-habit-db --remote
npx wrangler secret put API_TOKEN     # モバイル / 管理画面から使う任意のトークン
npm run deploy                        # apps/web をビルドしてから Worker をデプロイ
```

### 管理画面（ローカル開発）

`apps/web/env.example` を `.env.local` へコピーし、デプロイ済み Worker のオリジンを設定します。

```bash
cp apps/web/env.example apps/web/.env.local
npm --prefix apps/web run dev
```

## 開発

規約・デザイン方針・構成メモはリポジトリルートの `.agents/` に集約しています。

- `.agents/AGENTS.md` — 入口。3アプリの責務境界とルールの読み込み順
- `.agents/DESIGN.md` — ビジュアルデザインの正本
- `.agents/rules/` — 対象に応じて読むコーディング規約

```bash
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run lint
npm --prefix apps/web run build
npm --prefix apps/api run typecheck
```

## ライセンス

[MIT](LICENSE)
