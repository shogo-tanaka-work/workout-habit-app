# workout-habit-app

筋トレの記録を、分析と習慣化につなげる個人開発プロダクトです。

記録はスマートフォンで、振り返りはブラウザで。という前提でアプリを3つに分けたモノレポ構成です。

## 構成

| ディレクトリ | 役割 | 技術 |
|---|---|---|
| `apps/mobile/` | 記録の入力。オフラインでも止まらない。端末内 SQLite は表示用キャッシュ＋操作キュー | Expo SDK 56 / React Native 0.85 / React 19 |
| `apps/api/` | D1 の所有者（**正データ**）・認証境界・集計ロジックの正本 | Hono / Cloudflare Workers / D1 |
| `apps/web/` | 読み取り専用の分析ダッシュボード | Vite / React 19 |

Cloudflare Worker は役割ごとに2つに分かれています。

- `workout-habit-api` — API 専用（`apps/api`）。静的アセットを持ちません
- `workout-habit-admin` — 管理画面（`apps/web`）の配信と、`/api/*` の API への中継

分離しているのは、管理画面のホストへ Cloudflare Access をまるごと適用するためです。
Access はホスト単位でしか JWT を付けないため、管理画面と API を同一オリジンへ寄せています。
その結果ブラウザから API を直接呼ぶ経路が無く、**CORS の設定は持ちません**。

## 主な機能

- ワークアウトの記録（種目・セット・重量・レップ）とテンプレートからの開始
- レストタイマー（完了音つき）
- 種目マスタの管理、プレート計算、Epley 式による推定 1RM と RM 換算表
- 履歴のカレンダー表示、体重・体脂肪率のボディログ
- 操作単位でのクラウド同期（オフライン中はキューに溜め、復帰時に送信）
- ブラウザでの分析（週次・月次推移、部位別ボリューム、種目別推移、継続状況のヒートマップ）
- **Claude Code との連携** — 対話で組んだトレーニング計画を API へ書き込み、
  モバイルに「予定」として取り込む

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

### API Worker（workout-habit-api）

D1 データベースを作成し、`apps/api/wrangler.jsonc` の `database_id` を自分のものに差し替えます。

```bash
cd apps/api
npx wrangler d1 create workout-habit-db
npx wrangler d1 migrations apply workout-habit-db --remote
npx wrangler secret put ACCESS_TEAM_DOMAIN  # Cloudflare Access のチームドメイン
npx wrangler secret put ACCESS_AUD          # Access アプリケーションの AUD
npx wrangler secret put GOOGLE_CLIENT_IDS   # モバイルの Google クライアント ID（カンマ区切り）
npm run deploy
```

**Secret は API Worker 側に置きます。** Access アプリ（守る対象のホスト指定）を掛けるのは
管理画面ホストですが、JWT を検証するのは API Worker だからです。
未設定のまま起動すると、認証をスキップせず 500 で止まります（fail closed）。

### 管理画面 Worker（workout-habit-admin）

環境変数の設定は不要です。API は同一オリジンの `/api/*` にあり、
Worker が Service Binding で API Worker へ中継します。

```bash
npm --prefix apps/web run dev      # ローカル開発
npm --prefix apps/web run deploy   # ビルド → デプロイ
```

デプロイ後、Cloudflare Access をこの Worker のホストへ適用してください。

## 運用

### Claude Code から API を使う

トレーニング計画の立案から端末への反映までの手順は
**[`.agents/memory/claude-code-integration.md`](.agents/memory/claude-code-integration.md)** にあります。
CLI トークンの用意、実績の読み取り、計画の書き込み、`GET /plans` での取り込みまで。

API トークンと接続先は、**リポジトリルートの `.env.local`** に置きます。
このファイルは `.gitignore` 済みで、リポジトリには含まれません。

```bash
set -a && . ./.env.local && set +a   # 環境変数として読み込む
```

トークンは D1 にハッシュしか保存されないため、平文はこのファイルにしか残りません。
**画面へ出力しないでください**（ターミナルの履歴や、AI へ貼ったログに残ります）。
漏れた場合は `api_tokens` の該当行を失効させて作り直します。

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
