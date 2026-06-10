# workout-habit-app（モノレポ）

筋トレ習慣化プロダクトのモノレポ。データ入力はスマホ、分析・ダッシュボードはブラウザ、という想定で
アプリを `apps/` 配下に分けて管理する。

## 構成

```
workout-habit-app/
  apps/
    mobile/     ← Expo (React Native) モバイルアプリ【現在の主開発対象】
    api/        ← クラウドバックアップ API（Hono + Cloudflare Workers + D1）
    web/        ← 分析ダッシュボード（Vite + React。api の static assets として配信）
```

## 開発規約の所在

各アプリの規約・設計指針は**そのアプリのディレクトリ内**に閉じる（重複は許容）。

- **モバイルアプリ**: `apps/mobile/AGENTS.md`（概要・目標構成）と `apps/mobile/.claude/`（rules / agents / commands）を参照する。
- **web アプリ**: `apps/web/AGENTS.md` を参照する。コーディング規約はモバイル側 rules に準じる。

ルート直下のこのファイルは**案内のみ**。実作業は対象アプリのディレクトリに入って行う。
