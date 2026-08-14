# workout-habit api — 開発ガイド

Cloudflare Workers 上の Hono API。**D1 の所有者であり、認証境界**。

役割は3つ。

1. 操作（intent）ベースの同期の受け口（`POST /sync/operations`）— 記録の正データはここ
2. 読み取り専用の分析 API（`/analytics/*`）— 集計ロジックの正本
3. Claude Code が書いた予定の配布（`GET /plans`）

**静的アセットは持たない。** 管理画面は別 Worker（`workout-habit-admin` / `apps/web`）が
配信し、`/api/*` を Service Binding でこの Worker へ中継する。同一オリジン扱いになるため
**CORS は持たない**（ブラウザから直接呼ばれる経路が無い）。

## 開発ルール

コーディング規約はリポジトリルートの `.agents/` に集約している。実装前に読む。

- `.agents/AGENTS.md` — 入口。3アプリの責務境界とルール読み込み順
- `.agents/rules/api.md` — Route の責務、エラー形式、エンドポイント追加手順
- `.agents/rules/d1.md` — SQL、バインド変数上限、スキーマ変更の波及先
- `.agents/rules/cloudflare-workers.md` — Bindings、静的アセットとの共存、デプロイ反映
- `.agents/rules/auth.md`、`secrets.md` — 認証と秘密値
- `.agents/memory/cloudflare.md` — リソース構成と、public リポジトリに書いてよい値
- `.agents/memory/auth-model.md` — 3経路の認証・必要な Secret・実装状況

## 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| ランタイム | Cloudflare Workers | `compatibility_date: 2026-06-01`、Observability 有効 |
| フレームワーク | Hono 4 | |
| DB | Cloudflare D1（binding: `DB`） | データベース名 `workout-habit-db` |
| 認証 | Access JWT / Google ID トークン / CLI トークンの3経路 | 検証は Web Crypto で自前実装（`src/auth/`） |

## ディレクトリ構成

```
src/
  index.ts      Hono アプリ本体（認証ミドルウェア・/health・route のマウント）
  env.ts        Bindings と Hono の型引数
  analytics/    集計の中身。sql（条件と式）/ period（期間の解釈）/ aggregate（取得と集計）
  feedback/     週次 AI フィードバック（weekly_feedback）の読み出し
  goals/        種目別の目標重量（exercise_goals）の読み出し
  trainingPhases/  フェーズ履歴（training_phases）の読み出し
  backup.ts     /backup の読み出しと置換（本人スコープ）
  tables.ts     同期対象エンティティの定義（列の型・親参照）。apps/mobile/src/db/syncTables.ts と対になる
  sync/         操作（intent）ベースの同期。validate（形式検証）・apply（冪等な適用）
  auth/         認証と認可。types / jwt / access / google / apiToken / users
  middleware/   authenticate（経路の振り分け）・authorize（ロール判定）
  db/scope.ts   行スコープの条件生成。WHERE user_id = ? を route へ散らさない
  routes/       ドメイン単位の route（analytics / sync / plans / me / apiTokens / feedback /
                goals / trainingPhases）
  utils/isoDate.ts  ISO 日付の計算。apps/mobile の utils/datetime.ts と同じ定義を保つ
migrations/     D1 のマイグレーション。0001 初期スキーマ / 0002 マルチユーザー化 /
                0003 操作ベース同期の台帳 / 0004 種目の上書き設定 /
                0005 週次フィードバックと種目別目標 / 0006 トレーニングのフェーズ
                **共有プリセット種目は migrations に入っていない**（seed.ts と D1 を直接揃える）
wrangler.jsonc  Worker 設定（D1 binding・migrations_dir）。assets は持たない
worker-configuration.d.ts  wrangler types の生成型
```

route は `routes/` へ置く。中身（SQL・集計・入力の解釈）は route から分け、
route には「入力の解釈 → 呼び出し → JSON 化」だけを残す。
`backup.ts` がトップレベルにあるのは分割前からの経緯で、倣う形ではない。

## エンドポイント

| パス | 認証 | 内容 |
|---|---|---|
| `GET /health` | 不要 | 死活確認 |
| `GET /backup` | 必要 | 本人の同期対象テーブルを返す（復元用） |
| `POST /sync/operations` | 必要 | 操作（intent）ベースの同期。冪等・部分成功 |
| `GET /plans` | 必要 | 期間内の予定（`status='planned'`）を本人分だけ返す。Step 5 の受信経路 |
| `GET /me` | 必要 | 自分の id / 表示名 / ロール。ユーザー一覧の経路は作らない |
| `GET /analytics/weekly` ほか | 必要 | 読み取り専用の集計。詳細は `src/routes/analytics.ts` |
| `GET /feedback` | 必要 | 週次 AI フィードバックのアーカイブ（週の新しい順）。書き込みは `/sync/operations` |
| `GET /goals` | 必要 | 種目別の目標重量。書き込みは `/sync/operations` |
| `GET /training-phases` | 必要 | 減量期・増量期・維持・中断の履歴（開始日の新しい順）。書き込みは `/sync/operations` |
| `/admin/api-tokens` | admin のみ | Claude Code 用トークンの発行・一覧・失効 |

端末からサーバへの反映は `POST /sync/operations`（操作ベース）に一本化してある。
全置換の `POST /backup` は使われないまま残っていたため 2026-08-13 に削除した。

静的アセットを持たないため、パスの振り分け設定は不要。追加したら認証要否を明示的に判断する。

## 開発コマンド

```bash
npm run dev        # wrangler dev（ローカル Worker）
npm run typecheck  # tsc --noEmit
npm run types      # wrangler types（Binding 変更後）
npm run deploy     # wrangler deploy（apps/web は別デプロイ）
npx wrangler deploy --dry-run   # 設定変更後の検証
```

`wrangler` は必ず `apps/api/` を作業ディレクトリにして実行する。
