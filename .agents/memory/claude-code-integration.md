# Claude Code 連携（Step 5）

**このプロダクトの差別化点。** Claude Code との対話でトレーニング計画を立て、その結果を API へ書く。
書かれた計画はモバイルに予定として現れ、ユーザーは実行しながら編集するだけでよい。

```
1. ユーザーが Claude Code に相談する
     「先週の結果を見て、今週のメニューを組んで」
2. Claude Code が API から実績を読む（GET /analytics/*）
3. 対話しながら計画を作る
4. Claude Code が計画を書く（POST /sync/operations）
5. モバイルが予定を取り込む（GET /plans）→ ホームに「予定しているメニュー」が出る
6. ユーザーが予定から開始する → 以降は普通の記録
```

## なぜやるか

既存のトレーニングアプリは「AI と一緒にトレーニング方法を考える」体験が弱く、
できたとしても有料プランに閉じ込められていることが多い。
**Claude Code のサブスクリプションを持っている人がその恩恵を受けられない**構造になっている。
そこを解くプロダクトにする。作者自身が真っ先に欲しいものであることが出発点。

## 決定事項

### 連携は HTTP のみ。MCP サーバーは作らない（2026-08-10）

Claude Code は既存のエンドポイントを `curl` / `fetch` で叩く。
**Claude Code 専用の書き込み API は作らない。** 計画は「別の書き手からの操作」であり、
モバイルと同じ `POST /sync/operations` で表現できる。経路を増やすほど認可の穴が増える。

### 予定値は残さない（上書き許容、2026-08-10）

予定は `workout_sets` の行として作り、実行時に同じ行を実測値で上書きする。
スキーマを増やさない代わりに「計画 vs 実績」の差分は見られない。
差分分析が要るようになったら、そのとき予定値の保持を設計する。

### 受信は `GET /plans`（期間まるごと、2026-08-10）

`?since=` の差分同期にはしない。削除が物理削除で tombstone を持たないため、
差分では「予定が消えたこと」を表現できない。
**期間内の予定をまるごと返し、端末はその期間を置き換える。**
返ってこなかった予定は消えたものとして扱われる。

実績（`active` / `completed`）は `GET /plans` から返さない。端末の記録を上書きさせないための境界。

## データモデル

Step 4 のテーブル再構築で必要な列は入っている。**追加のマイグレーションは不要。**

| 要素 | 実体 |
|---|---|
| 予定のワークアウト | `workouts.status = 'planned'` |
| 計画の出所 | `workouts.source`（`user` / `claude_code`、既定は `user`） |
| 予定の種目・セット | `workout_exercises` / `workout_sets`（実績と同じテーブル） |

端末側の `workouts.status` は CHECK 制約が無いため、`planned` の保存にマイグレーションは要らない。
`source` は端末に列が無く、取り込み時に落とす（`apps/mobile/src/db/syncTables.ts` が列の正本）。

## 使い方

### 1. トークンを用意する（初回のみ）

`whk_` で始まる不透明トークンを `api_tokens` に登録する。D1 にはハッシュだけが載る。

発行 API（`POST /admin/api-tokens`）は admin 認証が要るが、CLI からは Access JWT を出せない。
**最初の1本は D1 へ直接入れる**（ハッシュは平文の SHA-256 hex。`src/auth/apiToken.ts` と同じ）。

```bash
TOKEN="whk_$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
HASH=$(printf '%s' "$TOKEN" | shasum -a 256 | cut -d' ' -f1)
printf '%s' "$TOKEN" | pbcopy   # クリップボードへ。画面へ出さない

cd apps/api
npx wrangler d1 execute workout-habit-db --remote --command \
  "INSERT INTO api_tokens (id, user_id, name, token_hash, created_at, updated_at)
   VALUES (lower(hex(randomblob(16))), 'usr-owner', 'claude-code', '$HASH',
           strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
```

**トークンを画面へ出さない。** `echo` するとターミナルの履歴や、AI へ貼ったログに残る。
出してしまったら、その行を `revoked_at` で失効させて作り直す。

`datetime('now')` は `2026-08-11 05:19:03` を返し、DB の他の行（ISO 8601）と書式がずれる。
認証は `expires_at` / `revoked_at` しか見ないため動きはするが、`strftime` で揃える。

投入できたか確認する（`token_hash` は表示しない）。

```bash
npx wrangler d1 execute workout-habit-db --remote --command \
  "SELECT id, name, created_at, revoked_at FROM api_tokens"
```

2本目以降は 1本目のトークンで `POST /admin/api-tokens` を叩ける。
失効は `POST /admin/api-tokens/:id/revoke`。

### トークンと接続先の置き場所

**リポジトリルートの `.env.local`**（`.gitignore` 済み）に置く。

```bash
set -a && . ./.env.local && set +a
```

平文トークンは D1 に無い（ハッシュのみ）ため、**このファイルが唯一の保管場所**になる。
`rules/secrets.md` のとおり、値をリポジトリ内のファイルへ書かない。
`echo` などで画面へ出さない（履歴と、AI へ貼ったログに残る）。

### 2. 実績を読む

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API_URL/analytics/weekly?today=$(date +%F)"
```

基準日は `?today=YYYY-MM-DD` で渡す。サーバの UTC 今日を暗黙の基準にしない。
種目 ID の一覧は `GET /analytics/exercises` から引ける。

### 3. 計画を書く

`POST /sync/operations` へ操作を並べる。1リクエスト 200 操作まで。

```jsonc
{
  "operations": [
    { "id": "<一意なID>", "at": "2026-08-10T09:00:00.000Z", "op": "upsert",
      "entity": "workouts",
      "row": { "id": "w-2026-08-12", "performed_at": "2026-08-12",
               "status": "planned", "source": "claude_code", "memo": "胸の日",
               "last_saved_at": "2026-08-10T09:00:00.000Z",
               "created_at": "2026-08-10T09:00:00.000Z",
               "updated_at": "2026-08-10T09:00:00.000Z" } },
    { "id": "<一意なID>", "at": "2026-08-10T09:00:00.000Z", "op": "upsert",
      "entity": "workout_exercises",
      "row": { "id": "we-1", "workout_id": "w-2026-08-12", "exercise_id": "bench-press",
               "order_index": 0, "created_at": "...", "updated_at": "..." } },
    { "id": "<一意なID>", "at": "2026-08-10T09:00:00.000Z", "op": "upsert",
      "entity": "workout_sets",
      "row": { "id": "s-1", "workout_exercise_id": "we-1", "order_index": 0,
               "weight_kg": 80, "reps": 5, "rpe": 0, "rest_seconds": 180,
               "created_at": "...", "updated_at": "..." } }
  ]
}
```

書くときの決まりごと。

- `id`（操作 ID）は操作ごとに一意にする。同じ ID の再送は `duplicate` として無視される（冪等）
- 親から順に送る。存在しない `workout_id` / `exercise_id` は `row not found` で弾かれる
- `user_id` は送らない。所有者はサーバが認証結果から決める
- 部分成功する。HTTP 200 でも `results` の各要素を見て `rejected` を確認する
- 未知の列は通らない。列の正本は `apps/api/src/tables.ts`

### 4. 週次フィードバックと目標を書く（Step 9）

計画を書いたら、同じ `POST /sync/operations` で週次フィードバック（`weekly_feedback`）と
種目別の目標（`exercise_goals`）も書ける。専用の書き込み API は無い。読む向きは
`GET /feedback?months=&today=`（週の新しい順、months は 1〜24・既定 6）と `GET /goals`。

id は決定的に組み立てる。`wf-{userId}-{week_start}` / `goal-{userId}-{exercise_id}`
（userId は `GET /me` の `id`）。同期は `ON CONFLICT(id)` で上書きするため、
**同じ対象へ別の id で書くと UNIQUE(user_id, week_start) / UNIQUE(user_id, exercise_id) に
当たって失敗する。** 決定的な id なら再実行しても同じ行に収束する。
ユーザー ID を含めるのは、id が全ユーザーで一意である必要があるため（migration 0005 冒頭のコメント）。

```jsonc
{
  "operations": [
    { "id": "<一意なID>", "at": "2026-08-11T09:00:00.000Z", "op": "upsert",
      "entity": "weekly_feedback",
      "row": { "id": "wf-usr-owner-2026-08-10",
               "week_start": "2026-08-10",
               "body": "先週はベンチのボリュームが伸びた。\n今週は脚を1回増やす。\n睡眠を7時間確保する。",
               "created_at": "2026-08-11T09:00:00.000Z",
               "updated_at": "2026-08-11T09:00:00.000Z" } },
    { "id": "<一意なID>", "at": "2026-08-11T09:00:00.000Z", "op": "upsert",
      "entity": "exercise_goals",
      "row": { "id": "goal-usr-owner-bench-press", "exercise_id": "bench-press",
               "target_weight_kg": 100, "memo": "年内に100kg",
               "created_at": "2026-08-11T09:00:00.000Z",
               "updated_at": "2026-08-11T09:00:00.000Z" } }
  ]
}
```

書くときの決まりごと（計画と共通の規則に加えて）。

- `week_start` は**月曜はじまりの週開始日（YYYY-MM-DD）**。API の `weekStartIso` /
  モバイルの `startOfWeekIso` と同じ定義。週の途中の日付を入れない
- `body` はプレーンテキスト。項目は改行で区切る（Markdown 記法に依存しない）
- **フィードバックはアーカイブ。過去週の行を上書きしない。** 上書きしてよいのは
  同一週（今週ぶんの書き直し）だけ。過去週を直したくなっても新しい週へ書く
- `exercise_goals` は1種目1件。目標を更新するときは同じ id へ upsert する。
  親の `exercise_id` は共有プリセット（`bench-press` 等）でもカスタム種目でもよい

### 5. フェーズを読む・書く（Step 10）

**計画立案の前に `GET /training-phases` を読む。** 減量期か増量期か、いつからか、
ブランクに理由があるかを知らずに実績だけを見ると、データを誤読する。
**あわせて次節の `GET /profile`（目的・身長）も読む。** 期間の状態と恒常的な属性は
片方だけでは実績を解釈できない。

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/training-phases"
```

```json
{
  "phases": [
    { "phase": "cut", "startedOn": "2026-07-08", "endedOn": null, "note": "断酒中", "updatedAt": "2026-07-08T09:00:00.000Z" },
    { "phase": "break", "startedOn": "2026-04-01", "endedOn": "2026-05-31", "note": "引っ越しでジムに行けず", "updatedAt": "2026-06-01T09:00:00.000Z" }
  ]
}
```

**開始日の新しい順**。現在のフェーズは先頭の行（`endedOn` が `null` のうち `startedOn` が最大）。

| `phase` | 意味 |
|---|---|
| `cut` | 減量期 |
| `bulk` | 増量期 |
| `maintain` | 維持期 |
| `break` | 中断（引っ越し・怪我・多忙）。**期間として記録するためにある** |

#### 実績データの読み方

- **減量期（`cut`）は重量更新より維持を成功と評価する。** 摂取カロリーが足りない状態で
  重量が伸びないのは想定どおりであり、失敗ではない
- **`break` 期間を停滞と判定しない。** 記録が少ないのはジムへ行けなかったからで、
  トレーニングの内容が悪かったわけではない。この期間を含む前後比較は避ける
- 増量期（`bulk`）は重量とボリュームの更新を、維持期（`maintain`）は頻度の維持を見る
- `note` はそのフェーズの方針・制約（「断酒中」「回復優先」など）。計画の制約として扱う

#### 書き方

書き込みは他と同じ `POST /sync/operations`（entity: `training_phases`）。
id は決定的に組み立てる（`phase-{userId}-{started_on}`、userId は `GET /me` の `id`）。
別の id で同じ開始日を書くと `UNIQUE(user_id, started_on)` に当たって失敗する。

**フェーズを切り替えるときは、前のフェーズへ `ended_on` を入れてから新しい行を作る。**
`ended_on` が NULL のまま新しい行を足すと、進行中のフェーズが2本になり現在のフェーズが定まらない。

```jsonc
{
  "operations": [
    // 1. 前のフェーズを閉じる（既存行の id へ upsert）
    { "id": "<一意なID>", "at": "2026-07-08T09:00:00.000Z", "op": "upsert",
      "entity": "training_phases",
      "row": { "id": "phase-usr-owner-2026-04-01", "phase": "break",
               "started_on": "2026-04-01", "ended_on": "2026-05-31",
               "note": "引っ越しでジムに行けず",
               "created_at": "2026-04-01T09:00:00.000Z",
               "updated_at": "2026-07-08T09:00:00.000Z" } },
    // 2. 新しいフェーズを開く（ended_on は入れない＝進行中）
    { "id": "<一意なID>", "at": "2026-07-08T09:00:00.000Z", "op": "upsert",
      "entity": "training_phases",
      "row": { "id": "phase-usr-owner-2026-07-08", "phase": "cut",
               "started_on": "2026-07-08", "note": "断酒中",
               "created_at": "2026-07-08T09:00:00.000Z",
               "updated_at": "2026-07-08T09:00:00.000Z" } }
  ]
}
```

- `phase` は4値のいずれか。DB の CHECK 制約に当たるため、それ以外の値は書けない
- `started_on` / `ended_on` は `YYYY-MM-DD`（日付のみ。時刻を含めない）
- 期間は重ねない。切り替えの `ended_on` は新しいフェーズの前日を入れる

### 6. 基本情報を読む・書く（Step 11）

**計画立案の前に `GET /profile` も読む。** フェーズ（期間の状態）と基本情報（恒常的な属性）は
両方読んで初めて実績を正しく解釈できる。目的を知らずに実績だけを見ると、
伸ばすべき指標を取り違える。

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/profile"
```

```json
{
  "profile": {
    "trainingGoal": "strength",
    "heightCm": 172,
    "note": "腰に持病あり。デッドリフトは慎重に",
    "updatedAt": "2026-08-14T09:00:00.000Z"
  }
}
```

**未設定なら `profile` は `null`**（404 にはならない）。その場合は目的を仮定せず、
ユーザーに確認してから計画を立てる。

| `training_goal` | 意味 | 評価の主指標 |
|---|---|---|
| `strength` | 筋力向上 | **トップ重量と推定1RM** |
| `hypertrophy` | 筋肥大 | 総ボリューム（重量 × レップ × セット）と週あたりのセット数 |
| `endurance` | 持久力 | レップ数と、同重量での反復の伸び |
| `general` | 総合 | 頻度の維持と、上記のバランス |

#### 実績データの読み方

- **`strength` なら評価の主指標はトップ重量と推定1RM であり、総ボリュームではない。**
  低レップ高重量ではボリュームは伸びにくいため、**ボリュームの増減で良し悪しを判断しない。**
  目的どおりに進んでいても総ボリュームは横ばいか減ることがある
- `hypertrophy` では逆に、1RM が横ばいでもボリュームが積み上がっていれば順調と見る
- `height_cm` は任意入力で、無いことが普通。**身長が無いから分析できない、としない。**
  筋力の体格補正は体重比（1RM ÷ 体重）で足り、身長が要るのは FFMI を一般基準と
  比べるときだけ
- `note` は恒常的な制約（持病・可用時間など）。フェーズの `note`（その期間の方針）とは別物で、
  どちらも計画の制約として扱う

#### 書き方

書き込みは他と同じ `POST /sync/operations`（entity: `user_profile`）。
**1ユーザー1行**で、id は決定的に組み立てる（`profile-{userId}`、userId は `GET /me` の `id`）。
別の id で2行目を書くと `UNIQUE(user_id)` に当たって失敗する。

```jsonc
{
  "operations": [
    { "id": "<一意なID>", "at": "2026-08-14T09:00:00.000Z", "op": "upsert",
      "entity": "user_profile",
      "row": { "id": "profile-usr-owner", "training_goal": "strength",
               "height_cm": 172, "note": "腰に持病あり。デッドリフトは慎重に",
               "created_at": "2026-08-14T09:00:00.000Z",
               "updated_at": "2026-08-14T09:00:00.000Z" } }
  ]
}
```

- `training_goal` は4値のいずれか。DB の CHECK 制約に当たるため、それ以外の値は書けない
- `height_cm` は省略可（未入力は NULL）。cm 単位の実数
- **目的はユーザーのものであり、Claude Code が勝手に変えない。** 書くのは本人の
  明示的な指示があったときだけ（通常の編集経路はモバイルの「トレーニング設定」画面）

### 7. 端末へ反映する

モバイルは起動時とアプリ復帰時に `GET /plans` を叩き、
**今日の 7 日前から 28 日後まで**の予定を取り込む（`apps/mobile/src/hooks/useWorkoutData.ts`）。
種目タブの「予定を取り込む」でも手動で引ける。

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/plans?from=2026-08-11&to=2026-08-17"
```

## 実装の所在

| 何 | どこ |
|---|---|
| 予定の取得 | `apps/api/src/routes/plans.ts` |
| フィードバックの取得 | `apps/api/src/routes/feedback.ts`（読み出しは `src/feedback/queries.ts`） |
| 目標の取得 | `apps/api/src/routes/goals.ts`（読み出しは `src/goals/queries.ts`） |
| フェーズの取得 | `apps/api/src/routes/trainingPhases.ts`（読み出しは `src/trainingPhases/queries.ts`） |
| 基本情報の取得 | `apps/api/src/routes/profile.ts`（読み出しは `src/profile/queries.ts`） |
| CLI トークンの検証 | `apps/api/src/auth/apiToken.ts` |
| トークンの発行・失効 | `apps/api/src/routes/apiTokens.ts` |
| 端末の取り込み | `apps/mobile/src/db/plans.ts` |
| 予定の表示・開始 | `apps/mobile/src/components/PlannedWorkoutSection.tsx` |

## 積み残し

- 管理画面での計画と実績の差分表示（予定値を残さない決定のため、出せるのは「予定を実施したか」まで）
- 汎用の差分同期（`?since=`）と tombstone。複数端末を使うようになったら必要になる
- `source` を UI に出すか。今は保存しているだけで、端末は列すら持たない
