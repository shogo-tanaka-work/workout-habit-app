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

**トークン値はこのリポジトリへ書かない**（`rules/secrets.md`）。

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

### 4. 端末へ反映する

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
| CLI トークンの検証 | `apps/api/src/auth/apiToken.ts` |
| トークンの発行・失効 | `apps/api/src/routes/apiTokens.ts` |
| 端末の取り込み | `apps/mobile/src/db/plans.ts` |
| 予定の表示・開始 | `apps/mobile/src/components/PlannedWorkoutSection.tsx` |

## 積み残し

- 管理画面での計画と実績の差分表示（予定値を残さない決定のため、出せるのは「予定を実施したか」まで）
- 汎用の差分同期（`?since=`）と tombstone。複数端末を使うようになったら必要になる
- `source` を UI に出すか。今は保存しているだけで、端末は列すら持たない
