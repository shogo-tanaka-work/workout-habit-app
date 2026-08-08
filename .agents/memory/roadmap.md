# 実行計画

このプロダクトの中期ロードマップと、確定済みの方針を記録する。作業を始める前に現在地を確認する。

## ステップ

| Step | テーマ | 主な成果物 | 状態 |
|---|---|---|---|
| 1 | `.agents` 整備 | `.agents/**`、各アプリの `AGENTS.md` を入口として整理 | 完了 |
| 2 | デザイン刷新 | `DESIGN.md` 準拠への監査と修正（mobile / web） | 完了 |
| 3 | GitHub 公開整備 | README / LICENSE / `docs/` 除外 / 公開前チェック | 完了（CI は見送り） |
| 3.5 | API と管理画面の分離 | Worker を役割ごとに2つへ分割・CORS 導入 | 完了 |
| 4 | 認証・マルチユーザー **＋ データフロー一本化** | 要件定義 → データモデル移行 → Access + Google + 操作ベース同期 | 進行中 |
| 5 | Claude Code 連携 | トレーニング計画の立案と書き込み。**このプロダクトの差別化点** | 未着手 |
| 6 | モバイルの UI/UX 改善 | 使い込んで見えてきた課題の解消 | 未着手 |

上から1ステップずつ進める。前のステップが終わるまで次に手を出さない。

**Step 4 に入る前に、次の2つを必ず読む。**

- `docs/10_プロダクト設計/同期アーキテクチャの設計.md` — D1 を唯一の正とし、
  端末をキャッシュ＋操作キューにする決定。**Step 4 と一体で実装する**
- `.agents/memory/claude-code-integration.md` — Step 5 の構想。Step 4 の設計判断に影響する

## 確定済みの方針

- `docs/`（企画・設計・調査・発信素材・運用ログ）は非公開のまま。リポジトリは public のため `.gitignore` へ入れる。
- 認証は次の二経路にする。詳細は `auth-model.md`。
  - 管理画面（ブラウザ）: Cloudflare Access（Google IdP）
  - モバイル: @react-native-google-signin の Google ログイン → Worker が Google ID トークンを検証
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

## Step 3.5: API と管理画面の分離

単一 Worker が API と静的配信を兼ねていたため、次の問題があった。

- Worker 名が `workout-habit-api` なのにルートを開くと管理画面が出る
- API がルート直下（`/backup` 等）にあり、管理画面と名前空間を共有していた
- ルートに Cloudflare Access を掛けるとモバイルの `/backup` も巻き込む

役割ごとに Worker を分けて解決する。構成は `cloudflare.md`。

データ層は Workers + D1 を継続する（検討の経緯と乗り換えの分岐点は
`docs/10_プロダクト設計/データ層の技術選定.md`）。

## 完了: インデックスと外部キー（Step 4 のテーブル再構築とまとめて実施）

**`migrations/0002_multi_user_schema.sql` に含めた（本番適用はまだ）。**
以下は判断の経緯として残す。

SQLite には `ALTER TABLE ADD CONSTRAINT` が無く、外部キーを足すには
「新テーブル作成 → データ複製 → 旧テーブル削除 → リネーム」の再構築が要る。
Step 4 の `user_id` 追加でも同じ再構築が必要なので、**1回の移行にまとめる。**

再構築のときに一緒に入れるもの。

- 外部キー制約（`FOREIGN KEY ... REFERENCES`）。想定する関係は
  `DB仕様書.md` の ER 図のとおり。削除時の挙動（CASCADE / RESTRICT）は要検討
- インデックス
  - `workout_exercises(workout_id)` / `workout_exercises(exercise_id)`
  - `workout_sets(workout_exercise_id)`
  - `workouts(performed_at)` / `workouts(status)`
  - `user_id` 追加後は各テーブルの `(user_id, ...)` 複合インデックス
- `body_logs.measured_at` の UNIQUE を `(user_id, measured_at)` の複合ユニークへ張り替え
  （現状のままだと、ユーザーをまたいで同じ測定日が衝突する）

前提となる移行機構は導入済み。

- モバイル: `apps/mobile/src/db/migrations.ts`（`PRAGMA user_version` 管理）
- D1: `apps/api/migrations/`（`wrangler d1 migrations apply` で適用）

`PRAGMA foreign_keys = ON` は接続時に有効化済み。制約を定義すれば即座に効く。

## 未使用の実装（Step 4 で扱いを決める）

- `timer_events` — 書き込み専用で読み出す実装が無い。分析 API も参照しない。
  バックアップ対象のため行数だけ増える。用途を決めるか、同期対象から外す
- `workout_sets.is_warmup` — 集計で区別しておらず、ウォームアップもボリュームに算入される
- `workout_sets.rpe`、`body_logs.estimated_calories_burned` — 列だけあって未使用

## Step 4: 認証・マルチユーザー ＋ データフロー一本化

**2つを一体で実装する。** どちらも `user_id` を軸にしたデータモデルの作り直しになるため、
認証を先に入れてから同期方式を変えると、テーブル再構築が2回になる。

### 進め方と現在地

| # | フェーズ | 状態 |
|---|---|---|
| 4-0 | 要件確定（CLI トークン・timer_events・移行方針・送信契機） | 完了 |
| 4-1 | D1 のテーブル再構築（`migrations/0002_multi_user_schema.sql`） | 完了（本番適用済み） |
| 4-2 | API の認証・認可・スコープ | 完了 |
| 4-3 | 操作ベース（intent）の CRUD エンドポイント | 完了 |
| 4-4a | モバイルの outbox とデータ層の書き換え | 完了 |
| 4-4b | モバイルの Google サインイン | 完了（シミュレータで疎通確認済み） |
| 4-5 | 管理画面（Cloudflare Access 適用・member 区画） | 完了（member 区画の切り分けは未着手） |

本番適用は 2026-08-07 に完了（migration 0002 / 0003 → API デプロイの順）。
モバイルからの同期疎通も確認済み。経緯と落とし穴は `docs/60_ログ/2026-08.md`。

4-0 で決めたこと（2026-08-07）。

- CLI トークンは `users` の列ではなく `api_tokens` テーブル。ハッシュのみ保存、失効は `revoked_at`
- `timer_events` は D1 に残し `user_id` を付ける（レストタイマー分析の余地を残す）
- 既存データは全行を所有者（`usr-owner` / admin）へ紐付ける
- 送信契機は「その種目の全セット完了」。種目レベルの完了操作を UI へ追加はしない
- 種目マスタは共有プリセット（`owner_user_id IS NULL`）＋ユーザーのカスタム種目の二層

4-3 で決めたこと（2026-08-07）。

- 操作の粒度は**行レベルの汎用 `upsert` / `delete`**。ドメイン操作ごとのエンドポイントは作らない。
  エンティティ×2種類で全操作を表せ、モバイルの outbox も「変更された行を積む」で済む。
  後勝ちなので「重量を 80kg へ」と「その行の最新状態」は等価
- 冪等台帳 `sync_operations` の主キーは `(user_id, id)`。
  操作 ID を全ユーザー一意にすると、他人が同じ ID を先に送って適用を妨げられる
- 送信先は `POST /sync/operations` の1本。部分成功を許し、結果は操作ごとに返す

### 実データの投入方針（2026-08-07 決定）

**現在 D1 にある記録（22 ワークアウト / 140 セット / 21 ボディログ）は仮データ。** 保全しない。

実データは、これまで使っていた外部製のトレーニング記録アプリの CSV エクスポートから移行する。
CSV を JSON / SQL へ整形して投入する。したがって「動作確認用のサンプルデータを補う」作業は不要。

移行時の論点（着手時に詰める）。

- 種目名のマッピング。CSV の種目名を共有プリセットの ID へ寄せるか、
  カスタム種目（`exercise-` 始まり）として作るか
- 投入経路。一括の歴史データなので `wrangler d1 execute --file` で直接入れる方が単純
  （`POST /sync/operations` は 1 リクエスト 200 操作の上限があり、大量投入には向かない）
- `user_id` は投入時に `usr-owner` を埋める。`workouts.source` は `user`

### 4-4a で見つかった宿題

- **プリセット種目のレスト時間変更が同期されない。** プリセットは全ユーザー共有の行のため
  サーバ側で書き換えられず、現状は端末内にとどまる。ユーザーごとの上書き
  （`user_exercise_settings` のようなテーブル）が要る。Step 6 の UI 改善と合わせて設計する
- 「同期を一時停止」トグルは未実装。送信役だけを止める形にすれば保存処理は1実装のまま
- オンライン復帰の検出はライブラリ未導入のため、アプリの復帰（AppState active）で代替している

### 4-5 で決めたこと（2026-08-07）

管理画面と API は**同一オリジンへ寄せる**。`workout-habit-admin` Worker が dist の配信に加え、
`/api/*` を Service Binding で `workout-habit-api` へ中継する。

Cloudflare Access はホスト単位で守り、`Cf-Access-Jwt-Assertion` は保護したホスト宛の
リクエストにしか付かない。別オリジンのままでは画面からの fetch に JWT が乗らず、
API 側にも Access を掛けると未認証の XHR がログイン画面へのリダイレクトを受けて壊れる。

Step 3.5 の Worker 分割は維持する。中継役は経路を束ねるだけで、集計も認可も API Worker のまま。

実装上の落とし穴（2026-08-08 に踏んだもの。詳細は `docs/60_ログ/2026-08.md`）。

- Workers Assets は既定でアセットを先に解決するため、`/api/*` が SPA フォールバックに吸われる。
  `assets.run_worker_first` で中継対象のパスだけ Worker を先に走らせる
- **`ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` は `workout-habit-api` に設定する。**
  検証するのは api Worker であり、admin は中継するだけ。
  Access アプリ（守る対象のホスト指定）は admin に掛けるので、名前が同じで紛らわしい

残る宿題。

- API の CORS（`ALLOWED_ORIGINS`）は管理画面が同一オリジンになったため不要になった。削除する
- `API_TOKEN` も未使用のまま残っている。削除する
- `member` へ開放する区画の切り分けは未着手（現状は Access の許可メールで入口を制御するだけ）

### データフロー一本化（2026-08-07 決定）

端末と D1 の二重管理をやめ、**D1 を唯一の正データ**にする。
端末は表示用キャッシュと操作キュー（outbox）を持つ薄い層になる。
`/backup` の全置換は廃止し、操作（intent）を送る CRUD エンドポイントへ移行する。

決定済みの詳細は `docs/10_プロダクト設計/同期アーキテクチャの設計.md`。要点だけ再掲する。

- 書き込み経路は常に1本（ローカル即時反映＋キュー積み）。切り替えるのは送信タイミングだけ
- 送信契機は**種目単位**（種目の完了時）。補助的にワークアウト完了・バックグラウンド遷移・
  手動ボタン・オンライン復帰を用意する
- 競合は**後勝ち**
- 鮮度表示はモバイルに出さない。管理画面のみ（出すとしても）
- 「機内モード」は作らない。ユーザーに概念を見せず、結果として同じ状態にする

却下した案とその理由も同ドキュメントに記録済み（純シンクライアント＝圏外で記録できない、
機内モードトグル＝書き込み経路が2実装になり、正しさをユーザーの予測に依存させる）。

## Step 4 の従来からの論点

現行 API は「単一 Bearer トークン」「`/backup` で全テーブルを DELETE → INSERT 全置換」で動いており、
マルチユーザーとは非互換。実装前に要件定義で次を決める。

1. ロール定義 — `admin` と `member` の機能境界を画面単位で確定する
2. データモデル — 全テーブルへの `user_id` 付与、`users` テーブル（email / sub / role）、既存データの移行手順
3. API 境界 — `/backup` をユーザースコープの置換に変更する（他人のデータを消さないこと）。
   `/analytics/*` も `user_id` でフィルタする。認証は Access JWT と Google ID トークンの二経路
4. モバイルのログイン — @react-native-google-signin + Google、ID トークンは保存しない
5. AI 計画立案 — Workers AI か外部 LLM API か、コスト上限とレート制限の置き方（未検討）
