# workout-habit api — 開発ガイド

Cloudflare Workers 上の Hono API。**D1 の所有者であり、認証境界**。

役割は2つ。

1. モバイルアプリのクラウドバックアップ（`/backup` の GET / POST）
2. 読み取り専用の分析 API（`/analytics/*`）— 集計ロジックの正本

**静的アセットは持たない。** 管理画面は別 Worker（`workout-habit-admin` / `apps/web`）が
配信するため、この Worker は純粋な API として動く。別オリジンになるので CORS を設定している。

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
| CORS | hono/cors | 許可オリジンは `ALLOWED_ORIGINS` シークレット |
| 認証 | Access JWT / Google ID トークン / CLI トークンの3経路 | 検証は Web Crypto で自前実装（`src/auth/`） |

## ディレクトリ構成

```
src/
  index.ts      Hono アプリ本体（CORS・認証ミドルウェア・/health・route のマウント）
  env.ts        Bindings と Hono の型引数
  analytics.ts  /analytics/* の集計エンドポイント
  backup.ts     /backup の読み出しと置換（本人スコープ）
  tables.ts     同期対象エンティティの定義（列の型・親参照）。apps/mobile/src/db/sync.ts と対になる
  sync/         操作（intent）ベースの同期。validate（形式検証）・apply（冪等な適用）
  auth/         認証と認可。types / jwt / access / google / apiToken / users
  middleware/   authenticate（経路の振り分け）・authorize（ロール判定）
  db/scope.ts   行スコープの条件生成。WHERE user_id = ? を route へ散らさない
  routes/       ドメイン単位の route（apiTokens）
migrations/     D1 のマイグレーション。0001 が初期スキーマ、0002 がマルチユーザー化
wrangler.jsonc  Worker 設定（D1 binding・migrations_dir）。assets は持たない
worker-configuration.d.ts  wrangler types の生成型
```

`index.ts` が 300 行を超えたら `routes/` `services/` `repositories/` `middleware/` へ分割する。

## エンドポイント

| パス | 認証 | 内容 |
|---|---|---|
| `GET /health` | 不要 | 死活確認 |
| `GET /backup` | 必要 | 本人の同期対象テーブルを返す（復元用） |
| `POST /backup` | 必要 | 本人の行だけを置き換える（**破壊的**） |
| `POST /sync/operations` | 必要 | 操作（intent）ベースの同期。冪等・部分成功 |
| `GET /analytics/weekly` ほか | 必要 | 読み取り専用の集計。詳細は `src/analytics.ts` |
| `/admin/api-tokens` | admin のみ | Claude Code 用トークンの発行・一覧・失効 |

`POST /backup` はモバイルが outbox へ移行するまでの経路。移行後は
初回同期（D1 → 端末）の `GET /backup` だけを残す。

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
