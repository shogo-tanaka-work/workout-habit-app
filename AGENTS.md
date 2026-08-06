# 筋トレ習慣化アプリ（モノレポ）

筋トレ習慣化プロダクトのモノレポ。データ入力はスマホ、分析・ダッシュボードはブラウザ、
という想定でアプリを `apps/` 配下に分けて管理する。

## 構成

```
筋トレ習慣化アプリ/
  .agents/      ← 開発ルール・デザイン正本・構成メモ
  apps/
    mobile/     ← Expo (React Native) モバイルアプリ【入力】
    api/        ← Hono + Cloudflare Workers + D1【サーバ】
    web/        ← Vite + React 分析ダッシュボード【管理画面】
  docs/         ← 企画・設計・調査・発信素材・運用ログ（非公開）
```

## 開発規約の所在

**規約の入口は `.agents/AGENTS.md`**。実装前に必ず読む。

- `.agents/AGENTS.md` — 3アプリの責務境界、必須ルール、`rules/` の読み込み順
- `.agents/DESIGN.md` — ビジュアルデザインの正本
- `.agents/memory/roadmap.md` — 大きな実行計画と決定済み方針。作業の位置づけを確認する
- `.agents/rules/` — 対象に応じて読むコーディング規約

アプリ固有の技術スタック・画面構成・開発コマンドは、それぞれの `AGENTS.md` にある。

- `apps/mobile/AGENTS.md`
- `apps/api/AGENTS.md`
- `apps/web/AGENTS.md`

ルート直下のこのファイルは**案内のみ**。
