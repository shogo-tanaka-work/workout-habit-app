# 実行計画

このプロダクトの中期ロードマップと、確定済みの方針を記録する。作業を始める前に現在地を確認する。

## ステップ

| Step | テーマ | 主な成果物 | 状態 |
|---|---|---|---|
| 1 | `.agents` 整備 | `.agents/**`、各アプリの `AGENTS.md` を入口として整理 | 完了 |
| 2 | デザイン刷新 | `DESIGN.md` 準拠への監査と修正（mobile / web） | 完了 |
| 3 | GitHub 公開整備 | README / LICENSE / `docs/` 除外 / 公開前チェック | 完了（CI は見送り） |
| 4 | 認証・マルチユーザー | 要件定義 → データモデル移行 → Access + Google 実装 | 未着手 |

上から1ステップずつ進める。前のステップが終わるまで次に手を出さない。

## 確定済みの方針

- `docs/`（企画・設計・調査・発信素材・運用ログ）は非公開のまま。リポジトリは public のため `.gitignore` へ入れる。
- 認証は次の二経路にする。詳細は `auth-model.md`。
  - 管理画面（ブラウザ）: Cloudflare Access（Google IdP）
  - モバイル: expo-auth-session の Google ログイン → Worker が Google ID トークンを検証
- 権限は `admin`（本人・全機能）と `member`（一般ユーザー・機能限定）の2ロール。
- 一般ユーザーへ開放するのは「成長推移の閲覧」と「AI による次回計画立案」。記録の入力はモバイルのみ。
- Cloudflare のアカウント ID・Access team domain / AUD・許可メールアドレス・トークン値は
  このリポジトリへ書かない。`~/agents-share/projects/` 側か Cloudflare ダッシュボードにのみ置く。
- リポジトリの絶対パスは全階層 ASCII にする。日本語ディレクトリ下では iOS ビルドが通らない
  （理由と対処は `.agents/rules/mobile-react-native.md`）。2026-08-05 に
  `~/開発/個人開発/筋トレ習慣化アプリ` から `~/personal-development/workout-habit-app` へ移設済み。

## Step 2: デザイン刷新

`DESIGN.md` を正本として、実装を監査してから直す。

現状の実測（2026-08-05 時点）では、生成 AI の UI にありがちな「全部カード」「影の乱用」は起きていない。
モバイルは `shadow` / `elevation` が 0 件、`borderRadius` が 24 箇所。
web は `box-shadow` が 0 件、`border-radius` が 3 箇所（すべて操作要素）。

したがって論点は装飾の削減ではなく、次の3つに絞る。

1. 情報の優先順位 — 画面で最初に読ませたい数値が最初に来ているか
2. 画面ごとの固有性 — Home / Workout / History / Exercise が同じ骨格の使い回しになっていないか
3. 文言のテンプレ感 — 見出し・空状態・エラー文が汎用的すぎないか

監査結果を課題リストにしてから修正に入る。いきなり CSS / StyleSheet を触らない。

## Step 3: GitHub 公開整備

リポジトリ `github.com/shogo-tanaka-work/workout-habit-app` は既に public で push 済み。
未整備なのは以下。

- `docs/` を `.gitignore` へ追加する（現状は未コミットのまま放置されている）
- README を公開リポジトリ向けに書き直す（`docs/` への参照を外す）
- LICENSE を追加する
- 公開前チェック: 秘密値、個人情報、他社アプリのスクリーンショットが tracked に混ざっていないか
- CI（typecheck + build）は任意

## Step 4: 認証・マルチユーザー

現行 API は「単一 Bearer トークン」「`/backup` で全テーブルを DELETE → INSERT 全置換」で動いており、
マルチユーザーとは非互換。実装前に要件定義で次を決める。

1. ロール定義 — `admin` と `member` の機能境界を画面単位で確定する
2. データモデル — 全テーブルへの `user_id` 付与、`users` テーブル（email / sub / role）、既存データの移行手順
3. API 境界 — `/backup` をユーザースコープの置換に変更する（他人のデータを消さないこと）。
   `/analytics/*` も `user_id` でフィルタする。認証は Access JWT と Google ID トークンの二経路
4. モバイルのログイン — expo-auth-session + Google、トークン保存先は expo-secure-store
5. AI 計画立案 — Workers AI か外部 LLM API か、コスト上限とレート制限の置き方（未検討）
