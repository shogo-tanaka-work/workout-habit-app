# 実行計画

このプロダクトの中期ロードマップと、確定済みの方針を記録する。作業を始める前に現在地を確認する。

## ステップ

| Step | テーマ | 主な成果物 | 状態 |
|---|---|---|---|
| 1 | `.agents` 整備 | `.agents/**`、各アプリの `AGENTS.md` を入口として整理 | 完了 |
| 2 | デザイン刷新 | `DESIGN.md` 準拠への監査と修正（mobile / web） | 完了 |
| 3 | GitHub 公開整備 | README / LICENSE / `docs/` 除外 / 公開前チェック | 完了（CI は見送り） |
| 3.5 | API と管理画面の分離 | Worker を役割ごとに2つへ分割・CORS 導入 | 完了 |
| 4 | 認証・マルチユーザー **＋ データフロー一本化** | 要件定義 → データモデル移行 → Access + Google + 操作ベース同期 | 完了 |
| 5 | Claude Code 連携 | トレーニング計画の立案と書き込み。**このプロダクトの差別化点** | 完了（差分表示は残） |
| 6 | モバイルの UI/UX 改善 | 監査で挙げた12件の課題を Phase 1〜5 の順に解消 | 完了（13・14 は保留） |

上から1ステップずつ進める。前のステップが終わるまで次に手を出さない。

**2026-08-11 時点で Step 1〜6 まで完了。** 次は UI の作り直し（Step 7）で、
デザインの方針から決める段階にある。着手前に `DESIGN.md` と
`docs/10_プロダクト設計/画面設計.md` を読む。

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

### 実データの投入（2026-08-10 完了）

外部アプリ（kinnik）の CSV エクスポートから移行した。仮データは削除済み。

```
workouts 23 / workout_exercises 67 / workout_sets 219 / exercises 28
2026-04-08 〜 2026-08-06 / 総ボリューム 103,387 kg（CSV と一致）
```

決めたこと。

- CSV に無かった種目 22 件は**共有プリセットへ昇格**（`owner_user_id IS NULL`）。
  `apps/mobile/src/db/seed.ts` も同じ内容へ更新した。**片方だけ変えない**
- 投入は `wrangler d1 execute --file`。`POST /sync/operations` は 1 リクエスト 200 操作の
  上限があり、一括の歴史データには向かない
- 体組成・有酸素の CSV は空だったため、**ボディログは 0 件**

経緯・検証方法・埋めた値の一覧は `docs/60_ログ/2026-08.md`、
生成スクリプトと SQL は `docs/60_ログ/2026-08-10_kinnik移行/`。

### 4-4a で見つかった宿題

- **プリセット種目のレスト時間変更が同期されない。** プリセットは全ユーザー共有の行のため
  サーバ側で書き換えられず、現状は端末内にとどまる。ユーザーごとの上書き
  （`user_exercise_settings` のようなテーブル）が要る。Step 6 の UI 改善と合わせて設計する
- ~~「同期を一時停止」トグル~~ — 2026-08-11 に実装。`app_settings` の `sync_paused`。
  止まるのは自動の送受信だけで、保存処理も手動送信も止めない
- ~~一時的な通信失敗が次の画面遷移まで送られない~~ — 2026-08-11 に実装。
  未送信が残っている間だけ60秒間隔で再送する。0 になればタイマーを張り直さない
- オンライン復帰の検出はライブラリ未導入のため、アプリの復帰（AppState active）で代替している。
  定期リトライを入れたことで、検出できないケースも実質的に吸収されるようになった

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

片付け済み（2026-08-08）。

- CORS（`ALLOWED_ORIGINS`）と `API_TOKEN` を削除。API はブラウザから直接呼ばれないため CORS 自体が不要
- `workout-habit-admin` へ誤って入れた `ACCESS_*` も削除

`member` の受け入れ（2026-08-11 完了）。

**UI で区画を隠す形にはしなかった。** member も自分のデータは全部見える。
境界は「他人のデータを読み書きできない」「共通データ（共有プリセット）を変えられない」の2点で、
どちらもサーバ側の行スコープと `sync/apply.ts` の所有者検査が担保している（監査結果は `rules/auth.md`）。

- `scopeForUser` / `scopeForExercise` の **admin 無制限（`1 = 1`）を廃止**。
  ユーザーが増えた瞬間に分析が全員の合算になるため
- `GET /me` を追加し、管理画面のヘッダーへ「誰として見ているか」を出す（表示名＋ロール）
- 管理画面に「これからの予定」セクションを追加（`GET /plans`）
- `resolveUser` が active な行の `display_name` / `google_sub` を補完するようにした。
  有効化は invited でしか走らず、**既存の active 行は永久に NULL のままだった**

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

## Step 5: Claude Code 連携

**4-5 の `member` 区画の切り分けより先に着手した**（2026-08-10 決定）。
member へ開放する機能の片方が Step 5 の成果物（AI 計画立案）であり、
それが揃ってから区画を切る方が二度手間にならないため。

決定と使い方は `.agents/memory/claude-code-integration.md`。要点だけ再掲する。

- 連携は **HTTP のみ。MCP サーバーは作らない**
- Claude Code 専用の書き込み API は作らない。計画は `POST /sync/operations` で書く
- 予定値は残さず**上書き許容**。スキーマ変更は不要（`planned` / `source` は Step 4 で入っている）
- 受信は `GET /plans`（期間まるごと）。差分にしないのは tombstone が無く削除を表現できないため

実装済み（2026-08-10）。

- `apps/api/src/routes/plans.ts` — 期間内の予定を本人分だけ返す
- `apps/mobile/src/db/plans.ts` — 期間を置き換える取り込み。**outbox には積まない**
- ホームの「予定しているメニュー」と「この予定で開始」（開始日で `performed_at` を上書き）
- 週の集計から `planned` を除外（予定のセットを実績として数えない）

本番での通し確認は 2026-08-11 に完了。
トークン発行（D1 へ直接 INSERT）→ `GET /plans` → `POST /sync/operations` で計画を書く →
端末が取り込んでホームに表示、まで実機で通っている。テスト行は削除済み。

残っているもの。

- 管理画面での計画と実績の差分表示（予定値を残さないため「実施したか」までが限界）
- 汎用の差分同期（`?since=`）と tombstone。複数端末を使うようになったら必要

## Step 4 の従来からの論点

現行 API は「単一 Bearer トークン」「`/backup` で全テーブルを DELETE → INSERT 全置換」で動いており、
マルチユーザーとは非互換。実装前に要件定義で次を決める。

1. ロール定義 — `admin` と `member` の機能境界を画面単位で確定する
2. データモデル — 全テーブルへの `user_id` 付与、`users` テーブル（email / sub / role）、既存データの移行手順
3. API 境界 — `/backup` をユーザースコープの置換に変更する（他人のデータを消さないこと）。
   `/analytics/*` も `user_id` でフィルタする。認証は Access JWT と Google ID トークンの二経路
4. モバイルのログイン — @react-native-google-signin + Google、ID トークンは保存しない
5. AI 計画立案 — Workers AI か外部 LLM API か、コスト上限とレート制限の置き方（未検討）

## Step 6: モバイルの UI/UX 改善

2026-08-11 に実装と画面を監査し、課題を並べてから着手する（Step 2 と同じ進め方）。

### 実施順と、その順にした理由

**Phase 1〜4 は JS のみで、ネイティブ再ビルドが要らない。** Phase 5 だけが再ビルドを伴うため
最後に置き、再ビルドを1回で済ませる。優先度と実施順が逆転しているのはこの都合による。

| Phase | 課題 | 触る範囲 |
|---|---|---|
| 1 | ~~#2 ウォームアップの集計~~ | 2026-08-11 完了 |
| 2 | ~~#4 RPE / #5 完了導線 / #11 入力確定 / #10 削除確認と復元~~ | 2026-08-11 完了 |
| 3 | ~~#7 部位選択 → #8 種目編集 → #6 検索・絞り込み~~ | 2026-08-11 完了 |
| 4 | ~~#9 プリセットの上書き~~ | 2026-08-11 完了（migration 0004 / 端末 v4） |
| 5 | ~~#3 タイマー永続化 → #1 タイマー通知~~ | 2026-08-11 完了（`expo-notifications` 導入） |

Phase 3 の順序には意味がある。**#7 で作る部位ピッカーを #8 が使い、#8 で整った一覧に #6 が乗る。**
逆順だと同じものを2回作る。Phase 4 を Phase 3 より先にやると、種目編集の UI ごと作り直しになる。

### Phase 5 で決めたこと（2026-08-11）

- **`expo-notifications` を導入した。** 永続化だけでは足りない。
  復元は「アプリに戻ったとき残り時間が正しい」を実現するが、
  **ポケットの中で休憩終了を知らせる**には OS に時刻を預けるしかない
- 前面にいるときは通知のバナーを出さない（アプリ内の音と振動が既に鳴っており二重になる）。
  `setNotificationHandler` で `shouldShowBanner: false`
- 許可は**タイマー開始時に初めて求める**。起動時に聞くと文脈が無い。
  **拒否されても失敗にしない**（通知が無くてもタイマー自体は使える）
- タイマーの状態は `app_settings` の `rest_timer` に JSON で持つ。端末ローカルのため同期対象外。
  **残り秒ではなく終了時刻（`endsAt`）を保存する。** 残り秒だけだと不在中の経過を復元できない
- 状態の更新口を `setTimer` ひとつに絞り、保存と通知予約をそこへ集約する。
  呼び出し側が「保存を忘れる」経路を作らない

### 課題リスト（監査 2026-08-11）

**高: あるのに効かない**

1. **休憩タイマーは画面を消すと動かない。** `setInterval` と `expo-audio` だけで通知が無い。
   休憩中に画面を消すのは自然な行為で、その間カウントは進まず音も鳴らない
2. **ウォームアップがボリュームに算入される。** `is_warmup` を指定できるのに
   `summarizeSets` も分析 API も区別しない。指定できるのに反映されないのは、無い機能より悪い
3. タイマーがアプリ再起動で消える（`TimerState` は `useState` のみ）

**中: 手数と探しにくさ**

4. 使っていない RPE が入力欄の3分の1を占める（本番データは全行 0）
5. セット完了がタイマー起動とセット。**タイマー不要で完了だけ付ける導線が無い。**
   履歴の編集（`showTimer=false`）では完了チェックを操作できない
6. 種目チップが全件並ぶ。検索も部位フィルタも無い（実データで28種目）
7. **カスタム種目の部位が選べない。** `bodyParts[0]` 固定で、必ず「胸」になる
8. 種目を編集できない。レスト時間以外（名前・部位・バー重量・アーカイブ）の手段が無い
9. プリセット種目のレスト時間変更が同期されない。`user_exercise_settings` 相当が要る
10. セット削除に確認が無い。論理削除だが**復元する UI が無い**
11. 数値入力の確定操作が毎回要る（`decimal-pad` にリターンキーが無い）

**低: 保留（2026-08-11 にユーザー判断で後回し）**

12. 前回実績は記録中しか出ない。履歴では前回比較ができない
15. ~~種目詳細の RM 換算表が横にはみ出す~~ — 2026-08-11 修正。固定幅で
    76 + 52×6 = 388px となり、使える幅 358px を 30px 超えていた。列を flex に変えた
16. ~~種目詳細の空状態で画面の目的が伝わらない~~ — 2026-08-11 修正。
    ヘッダーと重複する種目名をやめ、この画面で何が見られるかを書いた。
    「過去の記録」「推移」の見出しも裸テキストからセクション見出しへ揃えた
13. `timer_events` は書き込み専用。読み出しも分析も無い
14. `rpe` / `estimated_calories_burned` が未使用。使うか消すかを決める

12 は Phase 2〜3 のいずれかで扱う。13・14 は着手しない。

### Phase 1・2 で決めたこと（2026-08-11）

- **ウォームアップは集計に入れない。** 対象はボリューム・レップ・セット数・推定1RM。
  やったこと自体は見せられるよう `SetSummary.warmupCount` に件数だけ残す
- **RPE は入力欄から外した。** 列とデータは残している（消すかどうかは #14 で別途判断）。
  新規セットの既定値は 8 から 0 へ（実績データもすべて 0 で、8 は根拠のない値だった）
- **完了はタイマーと切り離した。** セットごとに「完了」ピルを置き、
  「完了＋タイマー」も残す。履歴の編集画面でも完了を操作できるようになった
- 数値入力は iOS のキーボードアクセサリ（`InputAccessoryView`）で閉じられるようにした。
  `decimal-pad` にリターンキーが無く、確定のたびに画面タップが要っていた
- セット削除に確認を挟み、**「削除したセット n 件 → 戻す」**を種目内に出す。
  論理削除でも戻す手段が無ければ、消した時点で実質失われる

### Phase 3 で決めたこと（2026-08-11）

- **種目の編集はカスタム種目だけ。** プリセットは全ユーザー共有でサーバが書き換えを拒むため、
  編集させると端末とサーバが静かに食い違う。モーダルで入力を無効にし、理由を画面に出す
- **アーカイブ済みも読み込む。** 以前は `WHERE is_archived = 0` で除外しており、
  アーカイブすると戻す手段が無くなるうえ、過去の記録から種目名を引けなくなっていた。
  読み込みは全件にし、選択肢に出す `activeExercises` を派生で作る
- 絞り込み（種目名の部分一致＋部位）は記録画面と種目タブの両方に置く。
  並び順は使用頻度順のまま変えない

### Phase 4 で決めたこと（2026-08-11）

上書きは `user_exercise_settings`（D1 は migration 0004、端末は user_version 4）。
対象は**休憩・バー重量・非表示の3つ**。**名前と部位は対象にしない**
（変えられると同じ ID が人によって別の種目を指すことになる）。

- **主キーは `id`。** 操作ベース同期が `ON CONFLICT(id)` と `WHERE id = ?` で動いており、
  id が全ユーザーで一意である前提。`(user_id, exercise_id)` の複合主キーだと汎用同期に乗らない。
  `id = exercise_id` も、別ユーザーの行と衝突して更新が黙って効かなくなる
- `(user_id, exercise_id)` に UNIQUE を張る。端末側は単一ユーザーなので `(exercise_id)`
- **NULL は「上書きしない」。** 実効値は `COALESCE(上書き, 種目の既定)` で、
  `loadWorkoutData` が畳み込んでから配る（画面ごとに合成すると必ずどこかで忘れる）
- 書き込みの経路は種類で分かれる。カスタム種目は `exercises` の行を直接更新し、
  プリセットは上書きテーブルへ書く

**既知の制約:** 複数端末で同じ種目の上書きを別々の id で作ると UNIQUE に当たり、
片方の同期が拒否される（5回で破棄）。現状は1端末運用のため許容する。

## Step 7: UI の作り直し（2026-08-14 完了）

**デザイン面の全面作り直しは 2026-08-14 にクローズ判断。** Step 2 のデザイン刷新と
Step 6〜8 の改修で UI 含め修正が進んでおり、独立フェーズとして残す理由が無くなった。
今後の UI 変更は個別課題として扱う（正本は `DESIGN.md` のまま）。

### ~~TODO: 種目タブから設定を分離する~~（2026-08-12 実装済み。消し込み漏れだった）

種目タブが「種目マスタの管理」と「アプリ設定」の2役を持っていた件。
コミット `0a636d1`「種目タブを用途別の設定メニューに作り替える」で解消済み。
現在の設定タブは入口メニュー（マスタ管理／ツール／設定／データ）で、
タイマー設定・プレート計算機・CSV書き出しは種目一覧から分離されている。
クラウド同期も同メニュー配下の独立サブ画面になっており、追加の分離は不要。

### コーディングルールに沿わせる修正（2026-08-13 完了）

`.agents/rules/` を整えたうえで、ESLint（typescript-eslint の recommended-type-checked）を
3アプリへ入れ、警告0にしてから設計面の指摘を高→中→低の順に潰した。
3アプリとも typecheck / lint はクリーン。付随タスク2件も 2026-08-13 に実装済み（下記）。

### モバイルの再レンダリングと再読込を減らす（2026-08-13 実装。実機計測が残）

背景: `reloadData` が書き込みのたび（19か所）に全11テーブルを読み直し、
11個の state が全部新しい参照になって `App.tsx` 以下が全再レンダリングされていた。
メモは1文字打つたびにこの処理が走っていた。メモリは問題でないことは確認済み
（フックの戻り値 5.8 KB、実データ 604 セット＝141 KB の 1/24）。

実装したこと。

- **`reloadTables(database, tables)` を導入し、書き込んだテーブルだけ再読込する。**
  19サイト中17は1〜3テーブルで済む。全テーブルの `reloadData` を使うのは
  起動時とクラウド復元だけ。書き込みゼロで reload していた2サイト
  （`startWorkout` の既存 active 分岐と `startWorkoutFromTemplate` の衝突分岐）は
  `['workouts']` へ縮小した（state が知らない active 行の取り込み用途は残る）
- 種目は上書き（`user_exercise_settings`）を畳み込んでから配るため、
  **どちらか一方を指定しても両テーブルを読み直す**（`loadWorkoutData.ts` でローダーを共有）
- **メモ入力を draft + 確定時保存へ。** 数値入力（`NumberCell` / `LabeledNumber`）と同じ形。
  `SetActionSheet` はシートを閉じるとき、`SetEditor` は入力確定（blur / return）で保存する。
  1文字ごとの「2 UPDATE + 全読込 + 全再描画」が消えた。
  **落とし穴:** 閉じ際に別の patch と2回に分けて送ると、両方が閉じた時点の state から
  組み立てるため先の変更が消える。1回の patch にまとめること（`withMemoDraft`）
- **`React.memo` + `useCallback` + 抜けていた `useMemo`。** memo の対象はカレンダー
  （`MonthCalendar`）・グラフ（`TrendChart`）・セット表（`SetLogTable`）・編集行
  （`SetEditor` / `WorkoutExerciseList`）。前提として `useWorkoutData` / `useSync` の
  返す関数と `App.tsx` のハンドラを useCallback 化した（インラインアローのままでは
  props が毎回新参照になり memo が効かない）

残: **実機での計測。** `__DEV__` 時に `[perf] reload <テーブル> <ms>` ログを
`reloadTables` に仕込んである。実機でメモ入力・セット追加・種目完了を操作し、
再読込の粒度と待ち時間を確認する。再レンダリング回数は React DevTools の
Profiler（Highlight updates）で見る。

### web の部位別集計を API へ移す（2026-08-13 実装・デプロイ済み）

`BodyPartSection.tsx` の `sumByBodyPart`（クライアント集計）が規約の例外になっていた件。

- `/analytics/body-parts` は**期間合計**（部位ごと・ボリューム降順）を返す形へ変更。
  集計は D1 の `GROUP BY` で行い、route は5行（4層分離に整合）。
  週単位の内訳は消費者が `sumByBodyPart` だけだったため削除した
- web は `response.bodyParts` の表示整形のみに。`APIリファレンス.md` も更新済み
- レスポンス形状の破壊的変更だったため、デプロイは api → web の順で連続実行した
  （2026-08-13。逆順だと api が出るまで部位別セクションが壊れた画面になる）

## Step 8: パフォーマンスとセキュリティ（2026-08-13 開始）

Step 7（UI 作り直し）とは別軸の改修。進め方は「リサーチ → 規約整備 → 監査 → 修正」。

- リサーチは「モバイル特有」「Web(SPA)特有」「API 特有」のパフォーマンス3軸＋
  セキュリティ（OWASP Top 10 / API Top 10 / Mobile Top 10）で実施（2026-08-13）
- 規約は `rules/performance.md` と `rules/security.md` に整備した（2026-08-13）。
  既存 rules と重複させず、横断の観点と参照で束ねる構成。
  `d1.md`（ループ内 `.run()` 禁止・`EXPLAIN QUERY PLAN`）、`cloudflare-workers.md`
  （`waitUntil` の使い分け）、`mobile-react-native.md`（計測は RN DevTools）へも追記

### 監査結果（2026-08-14。3アプリ並列で実施）

事前に挙げた実装課題5件の判定。

1. ~~Access JWT の `aud` 検証~~ — **実装済みで対応不要。** 署名・aud・iss・exp の4点
   すべて検証、aud クレーム無しも拒否、JWKS は動的取得＋未知 kid で再取得
2. セキュリティヘッダ — **未実装を確認。** 現実装から逆算した CSP は
   `script-src 'self'` / `style-src 'self' 'unsafe-inline'`（inline style が
   `ContinuitySection` と `BodyPartSection` のバー幅2か所のみのため）で壊れない
3. レート制限 — **未実装を確認。** 増幅点は認証前の2経路
   （トークン総当たり→SHA-256+D1、偽 JWT→JWKS 再取得）と `/sync/operations`
4. 端末 SQLite の WAL — **設定はあるが新規インストールで効かない（むしろ危険）。**
   `PRAGMA journal_mode = WAL` が `SCHEMA_SQL` 先頭にあり、migration v1 として
   **トランザクション内で実行される**。SQLite はトランザクション中の WAL 化を
   エラーにするため、migration 機構導入（2026-08-06）以降の新規インストールは
   初期化に失敗する可能性が高い。既存端末は旧実装（トランザクション外）で
   WAL 化済みのため動いている。修正は接続時（`PRAGMA foreign_keys` の隣）へ移す
5. 依存 — lockfile は3アプリともコミット済み。`npm audit` の実行時依存の指摘は
   api の `hono`（moderate、未使用の hono/jsx）のみ。残りは開発ツール経由

### 監査で見つかった課題（2026-08-14 修正完了。以下は監査時点の記録）

**mobile**（高1・中4・低5）

- 【高】上記4の WAL 修正
- 【中】`seedMasters` が毎起動42文をトランザクション無しで逐次実行 → 1トランザクション化
- 【中】起動時に `restoreAccount()`（silent sign-in、ネットワーク待ちあり）が
  DB 準備と直列 → isReady 後の後追いへ
- 【中】同期先 API URL に `https://` の強制が無い（ID トークンの送信先）→ 保存時に拒否
- 【中】端末スキーマにインデックス4本不足（`workout_sets(workout_exercise_id)` /
  `workout_exercises(workout_id)` / `workouts(status, performed_at)` /
  `sync_outbox(entity, row_id)`。最後のは**毎書き込み**の enqueue が全走査）→ migration v5
- 【低】`startWorkoutFromTemplate` のループ内 insert / `replacePlannedWorkouts` の
  1件ずつ SELECT / `fetchBackupFromCloud` の浅い検証（`as` キャスト）/
  `pusher.recordFailure` のループ内 UPDATE / `app.json` の未使用 scheme

**api**（中4・低7）

- 【中】レート制限の導入（上記3。認証失敗 IP キー・`/sync/operations` userId キー・
  トークン発行の3点。結果整合＝暴走の頭打ちとして設計）
- 【中】`sync/apply.ts` の親・所有者チェックが同一行へ操作数ぶん重複 → リクエスト内メモ化
- 【中】認証の副作用（`last_used_at`・プロフィール補完。補完は**埋まっていても毎回
  UPDATE 発行**）が全リクエストのレイテンシに直列 → スキップ判定＋ `waitUntil`
- 【中】`/backup` の9テーブル逐次読み → `batch()` で1往復
- 【低】analytics の SQL 直書き残り4本（daily / body-logs / exercises / habit）の層分離 /
  body-logs 無制限取得（web と対）/ JWKS エラーに team domain が乗る /
  D1 生エラーをクライアントへ返す / 古いコメント（CORS 復活を誘導）/
  日時正規表現が緩い / daily・habit の独立2クエリ直列
- 認可の土台（行スコープ・fail closed・BOPLA・インデックス）は問題なし

**web**（高1・中2・低2）

- 【高】上記2のセキュリティヘッダ実装（アセット側レスポンスのみに付与。
  API 中継には付けない＝「中継時にヘッダを加工しない」規約と両立）
- 【中】中継 Worker が全メソッド・全パスを API へ開放 → **GET / HEAD 限定**にして
  読み取り専用を経路レベルで強制（CSRF 前提の曖昧さも消える）
- 【中】`/analytics/body-logs` だけ取得上限が無い（api 側と同一課題）
- 【低】`/analytics/exercises` を初期表示で2回取得（片方の `?today=` は API が
  読んでおらず無意味）/ 種目 ID のパス埋め込みに `encodeURIComponent` 無し
- XSS 面・localStorage・依存（react/react-dom のみ、gzip 66KB）・
  ウォーターフォール無しは確認済み

**依存更新**: `npm audit fix` を3アプリで実行し typecheck / build で検証（別変更セット）

### 修正の完了状態（2026-08-14）

上記の課題はすべて修正しコミット済み（mobile / api / web / 依存更新の4コミット）。
意図的に見送ったもの。

- `app.json` の未使用 `scheme` — ネイティブ再ビルドを伴うためスコープ外とした
- D1 生エラーのクライアント返却 — 受け手が本人のみ・スキーマ公開済みで実害がなく、
  端末側デバッグの利便を優先して現状維持
- 依存の残存3件（mobile: image-size high / uuid moderate、web: esbuild low）—
  いずれも開発ツール経由で配布物に乗らず、fix が breaking change のため見送り

**残作業**

1. デプロイ: api（レート制限の binding 追加を含む）と web。順序の制約は無し
2. 実機確認: 既存端末での起動（migration v5 適用）と、アプリ削除 → 再インストールでの
   初回起動（WAL 修正の検証。修正前は新規インストールが失敗し得た）
3. レート制限の疎通: 429 が返ることの確認は本番でしかできない（wrangler dev では
   limiter が常に成功する場合がある）。無理に叩かず、Observability で観察する程度でよい

## Step 9: 分析ダッシュボードの強化と AI フィードバック（2026-08-14 開始）

Step 5 の発展。決定済みの方針:

- **Chart.js を導入する**（本人承認済み。web の「チャートライブラリ導入は方針判断」を解決）。
  折れ線・積み上げバーを Chart.js へ、ヒートマップは自作 SVG のまま改善
- 色分けの単位は**部位**。ヒートマップは「その日の最大ボリューム部位」の色、
  部位別ボリュームは部位色の濃淡で種目を積み上げ。部位色は `DESIGN.md` を正本にする
- **web 先行、mobile は後続**（目標入力 UI とフィードバックのアプリ内表示は別スコープ）
- **AI フィードバックはアーカイブ形式**。週単位で残し、過去分も一覧から参照できる
- 書き込みは既存方針どおり `POST /sync/operations`（Claude Code 専用 API は作らない）

### スキーマ（D1 migration 0005 / 端末 v6。同期対象に追加）

- `weekly_feedback` — id / user_id / week_start / body / created_at / updated_at、
  UNIQUE(user_id, week_start)。Claude Code が計画立案時に書く
- `exercise_goals` — id / user_id / exercise_id / target_weight_kg / memo /
  created_at / updated_at、UNIQUE(user_id, exercise_id)。親は exercises

### API 契約

- `GET /feedback?months=&today=` → `{ feedback: [{ weekStart, body, updatedAt }] }`（新しい順）
- `GET /goals` → `{ goals: [{ exerciseId, targetWeightKg, memo, updatedAt }] }`
- `/analytics/body-parts` の各部位に `exercises: [{ exerciseId, name, setCount, totalVolume }]` を追加
- `/analytics/daily` の各日に `topBodyPartId` を追加
- いずれも既存フィールドは不変（追加のみ）。デプロイは api → web の順

### Step 9 の実装状態（2026-08-14）

api / web / mobile（同期対の追従のみ）を実装しコミット済み。web は旧 API レスポンスへの
フォールバックを持つため、デプロイ順の制約は「**D1 migration 0005 → api → web**」だけ
（migration 前に api を出すと /feedback・/goals が 500 になる）。

- 部位色はモバイルの `theme.ts` の `bodyPartColors` と同値を web の `styles.css` に定義
  （2アプリで表現を揃える。正本の対応は `DESIGN.md` の部位色の節）
- フィードバック・目標の書き込み手順（決定的 id の規則含む）は
  `claude-code-integration.md` の「4. 週次フィードバックと目標を書く」
- 残: mobile の表示と目標入力 UI（後続スコープ）、Step 5 から残っている
  計画と実績の差分表示・汎用の差分同期（`?since=` + tombstone）

## Step 10: トレーニングのフェーズ（2026-08-14 開始）

**きっかけ:** 計画立案の前提（減量期か増量期か、いつから、なぜブランクがあるか）が
プロダクトのどこにも無く、対話のたびに口頭で伝え直す状態だった。この情報が無いと
実績データの読み方を誤る。実例として、2026年4〜5月の記録の少なさは引っ越しで
ジムに行けなかったためだが、データだけ見ると3か月の停滞に見える。

### 設計

**`training_phases`** — フェーズの履歴として持つ（現在の状態だけを持つ1行にしない）。
過去の減量期の成果を振り返れること、ブランクの理由を期間へ紐付けられることが理由。

```
id TEXT PK / user_id / phase TEXT / started_on TEXT(YYYY-MM-DD) /
ended_on TEXT NULL(NULL = 進行中) / note TEXT / created_at / updated_at
UNIQUE(user_id, started_on)
```

- `phase` は `cut`（減量）/ `bulk`（増量）/ `maintain`（維持）/ `break`（中断）の4値。
  **`break` を含めるのが要点。** 引っ越し・怪我・多忙による中断を期間として記録でき、
  「なぜこの期間だけ落ちているか」をデータ側で説明できる
- 現在のフェーズ = `ended_on IS NULL` のうち `started_on` が最大の行
- `note` はそのフェーズの方針・制約（「断酒中」「回復優先」など）
- 書き込みは既存どおり `POST /sync/operations`。決定的 id は `phase-{userId}-{started_on}`
- 読みは `GET /training-phases`（新しい順。現在のフェーズが先頭）

### 効かせ方

- **Claude Code は計画立案の前にこれを読む。** 減量期なら「重量更新より維持」を
  成功と評価し、`break` 期間を停滞と判定しない
- 管理画面は現在のフェーズ（「減量期 2026-07-08〜」と経過日数）を出す
- モバイルは同期対の追従のみ（表示は後続スコープ）

### Step 10 の完了状態（2026-08-14）

api / web / mobile（同期対の追従のみ）を実装し、本番へ反映済み
（migration 0006 適用 → api → web の順）。実データも投入済み。

- `break` 2026-04-01〜2026-05-31（引っ越しでジムに通えず）
- `cut` 2026-07-08〜 進行中（断酒継続・リコンプ進行中）

**この情報が無いと実績データを誤読する。** 実例として、2026年4〜5月の記録の少なさは
引っ越しによる中断だが、データだけ見ると3か月の停滞に見える。計画立案の前に
`GET /training-phases` を読むこと（手順と解釈の指針は `claude-code-integration.md`）。

残: モバイルでのフェーズ表示と切り替え UI（後続スコープ。現状は Claude Code 経由で書く）

## Step 11: 基本情報（user_profile）とトレーニング設定画面（2026-08-14 開始）

Step 10 のフェーズに続き、**期間ではなく恒常的に持つ属性**を置く場所を作る。

### 調査で確定したこと（2026-08-14、出典は下記）

- **筋力の体格補正に身長は不要。** Wilks / DOTS / IPF GL はいずれも体重のみを入力とし、
  身長を使わない。筋力は体重の約 0.67 乗にスケールする（アロメトリックスケーリング）。
  「体格込みで伸びているか」は **1RM ÷ 体重（体重比）** で足りる
- **身長が要るのは体組成の評価（FFMI = 除脂肪体重 ÷ 身長²）。** ただし
  **同一人物の時系列では身長は定数**のため、推移の形は除脂肪体重(kg) と相似になる。
  身長が効くのは**一般基準・他者と比べるとき**だけ（正規化 FFMI で 20〜21.9 が良い等）
- したがって **`height_cm` は任意入力**とする（本人判断で入力済み）。
  無くても体重比・除脂肪体重は計算でき、分析の主要部分は動く

### スキーマ（D1 migration 0007 / 端末 v8。同期対象）

```
user_profile:
  id TEXT PK / user_id TEXT NOT NULL UNIQUE / training_goal TEXT NOT NULL /
  height_cm REAL(NULL 可・任意入力) / note TEXT NOT NULL DEFAULT '' /
  created_at / updated_at
```

- `training_goal` は `strength`（筋力向上）/ `hypertrophy`（筋肥大）/
  `endurance`（持久力）/ `general`（総合）の4値。CHECK を付ける
- 1ユーザー1行。決定的 id は `profile-{userId}`
- 読みは `GET /profile`。書きは既存どおり `POST /sync/operations`

### 効かせ方

- **Claude Code は計画立案の前にこれを読む。** 目的が `strength` なら
  **評価の主指標はトップ重量と推定1RM**であり、総ボリュームではない
  （低レップ高重量ではボリュームは伸びにくい。ボリュームの増減で良し悪しを判断しない）
- モバイルに「トレーニング設定」画面を作り、**目的・身長・メモの編集**と
  **フェーズの切り替え**を本人ができるようにする（現状は Claude Code 経由でしか書けない）

### 後続（body_logs にデータが入ってから）

分析の追加。**先に体重の記録が要る**（現状 `body_logs` は0件で、これが本当のボトルネック）。

- 種目別グラフに体重比（1RM ÷ 直近体重）
- ボディログに除脂肪体重（体重 ×(1 − 体脂肪率/100)）と、身長があれば FFMI

出典: Wilks/DOTS/IPF GL は https://rpe.training/guides/wilks-dots-ipf-gl-explained/ 、
アロメトリックスケーリングは https://pubmed.ncbi.nlm.nih.gov/18172672/ 、
FFMI は https://www.omnicalculator.com/health/ffmi と https://pubmed.ncbi.nlm.nih.gov/7496846/

### Step 11 の実装状態と既知の制約（2026-08-14）

api / mobile を実装（web は今回スコープ外。表示すべき新情報が「目的」だけのため）。

**既知の制約（Step 6 Phase 4 の `user_exercise_settings` と同種）:**
モバイルがフェーズを作るときの id は `newId('phase')` のランダム値で、Claude Code が使う
決定的 id（`phase-{userId}-{started_on}`）とは異なる。**端末に無い開始日の行がサーバに
あると、別 id で送ることになり UNIQUE(user_id, started_on) に当たって拒否される**
（5回で破棄）。端末が同期済みなら `ON CONFLICT(started_on)` が既存 id を保つため起きない。
端末が userId を知らない以上、決定的 id は組めない（id は全ユーザーで一意である必要がある）。
1端末運用のため現状は許容する。
