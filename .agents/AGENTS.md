# 筋トレ習慣化アプリ 開発ルール

このファイルを本モノレポのコーディングルールの入口とする。実装前に、変更対象へ該当する `rules/` を読む。

## 3つの役割と責務境界

| アプリ | 役割 | 責務 |
|---|---|---|
| `apps/mobile` | 入力 | トレーニング記録の唯一の入力経路。端末内 SQLite が正データ。`/backup` へ全件同期する |
| `apps/web` | 管理画面 | 読み取り専用の分析ダッシュボード。集計はしない。API の集計結果を表示整形するだけ |
| `apps/api` | サーバ | D1 の所有者、認証境界、`apps/web` の静的アセット配信元。集計ロジックの一元管理先 |

境界を越えさせない。

- モバイルは D1 を直接読まない。`/backup` の送受信だけを行う。
- web は書き込み系 API を呼ばない。集計をクライアントで再実装しない。
- API は表示都合の整形（桁揃え・ラベル文言・空週の穴埋め）を持たない。

## 技術構成

- モバイル: Expo SDK 56 / React Native 0.85 / React 19 / expo-sqlite
- API: Hono on Cloudflare Workers
- DB: Cloudflare D1（SQLite）
- 管理画面: Vite + React 19（workout-habit-admin Worker が静的配信。API とは別オリジン）
- 言語: TypeScript（全アプリ `strict: true`）

## 構成の把握

変更前に、対象に関わる `memory/` を読む。

- `memory/roadmap.md` — 大きな実行計画と決定済み方針。作業の位置づけを確認する
- `memory/cloudflare.md` — Worker / D1 / 静的配信の構成と、公開リポジトリに書いてよい値の線引き
- `memory/auth-model.md` — 認証のゴール像と未確定事項
- `memory/claude-code-integration.md` — Claude Code 連携（Step 5）の構想。
  **現行の全置換同期と衝突するため、データモデルや同期を触る前に読む**

データモデルや API を変更する前に、対応する仕様書を読む。実装を変えたら同じ変更セットで更新する。
`docs/` は非公開のためリポジトリには含まれない（ローカルにのみ存在する）。

- `docs/10_プロダクト設計/DB仕様書.md` — テーブル定義、ER 図、同期の仕組み、拡張性の弱点
- `docs/10_プロダクト設計/APIリファレンス.md` — エンドポイント一覧、リクエスト / レスポンス、拡張性の弱点

`DESIGN.md` はビジュアルデザインの正本。`docs/10_プロダクト設計/画面設計.md` は機能と UX の設計書として扱い、
視覚表現が競合する場合は `DESIGN.md` を優先する。

## 必須ルール

- `any` を使わず、外部入力は `unknown` から検証する。
- Route、入力検証、集計ロジック、D1 クエリを分離する。
- リクエスト固有の状態をモジュールスコープへ保存しない。
- Promise は必ず `await`、`return`、または `ctx.waitUntil()` で追跡する。
- Secrets をコードや Wrangler 設定へ直書きしない。
- SQL 値は D1 prepared statement の `bind()` で渡す。
- 端末内 SQLite のデータはユーザーのトレーニング記録＝代替不能。破壊的変更は段階適用する。
- 既存のマイグレーションとテストを無断で削除しない。
- README や `docs/` は、依頼の対象でない限り変更しない。

## ルール読み込み順

1. `rules/code-design.md`
2. `rules/typescript.md`
3. `rules/project-structure.md`
4. UI 変更では `DESIGN.md` と `rules/ui-design.md`
5. 変更対象に応じて以下を読む
   - モバイル: `rules/mobile-react-native.md`、`rules/mobile-sqlite.md`
   - 管理画面: `rules/web-react.md`
   - API: `rules/api.md`、`rules/d1.md`、`rules/cloudflare-workers.md`
   - 認証・デプロイ・秘密値: `rules/auth.md`、`rules/secrets.md`
6. 実装後に `rules/testing.md`

## 各アプリの入口

アプリ固有の技術スタック・画面構成・開発コマンドは、それぞれの `AGENTS.md` に置く。

- `apps/mobile/AGENTS.md`
- `apps/web/AGENTS.md`
- `apps/api/AGENTS.md`
