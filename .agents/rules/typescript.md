---
paths: "**/*.ts,**/*.tsx"
---
# TypeScript コーディングルール

3アプリすべて `tsconfig.json` は `strict: true`。型を緩める方向の回避策を入れない。

## 型安全性
- `any` は使わない。`unknown` で受けて型ガードで絞り込む
- 型アサーション (`as`) は最小限に。型ガード関数を優先する
- `as` と non-null assertion (`!`) の **併用禁止**。両方使いたくなったら型ガード関数を作る
- 外部入力（HTTP リクエストボディ、SQLite の行、API レスポンス）は必ず境界で検証する
- ドメイン型は各アプリの `src/types/` に集約する

### DB行型とドメイン型を分離する（本アプリの良例）
SQLite / D1 から取れる行（snake_case・全て nullable になりがち）と、UIで使うドメイン型（camelCase）は
別物として定義し、**変換関数1か所で型を保証**する。これが型ガード集約のお手本。

```ts
// types/db.ts — DBの生の行
interface BodyPartRow { id: string; name: string; order_index: number | null; }

// types/domain.ts — UIで使う型
interface BodyPart { id: string; name: string; orderIndex: number; }

// db/mappers.ts — 変換を1か所に閉じ込める（as も null 処理もここだけ）
export const toBodyPart = (row: BodyPartRow): BodyPart => ({
  id: row.id,
  name: row.name,
  orderIndex: row.order_index ?? 0,
});
```

`row.order_index! as number` のように各所で `!`/`as` を撒かない。`toBodyPart` を通す。

## 関数設計
- 純粋関数を優先し、副作用（DB・タイマー・通知・fetch）を分離する
- 早期リターンでネストを浅く保つ
- 引数は3つ以下。超える場合は名前付きオブジェクト引数にする
- コールバックのネストは避け、async/await で書く
- Promise を浮かせない。`await` / `return` / `ctx.waitUntil()` のいずれかで追跡する

## エラー処理
- エラーは握りつぶさない（[code-design.md](code-design.md) §8）
- 外部ライブラリ（expo-sqlite・D1）のエラーをそのまま再throw しない。**操作名を文脈として付与**する
- 元エラーを残すときは `Error` の `cause` を使う
- catch した値は `unknown` として受け、`instanceof Error` で型ガードする

## 命名規則
- 変数・関数: camelCase
- 型・インターフェース: PascalCase
- 定数: UPPER_SNAKE_CASE
- boolean: is / has / can / should プレフィクス
- イベントハンドラ: handleXxx / onXxx
- React Hooks: use プレフィクス
- **1〜2文字の省略変数名は禁止**（`status` `row` `query` と完全形で書く）
  例外: `i, j`（ループindex）、`_`（未使用引数）、`acc`（reduce）。`error` は省略しない

## インポート
- 相対パスで書く。3アプリとも `tsconfig` に `paths` を設定していない
  （ディレクトリが浅く、`../../` を超える import が発生していないため）
- 型のみのインポートは `import type` を使う
- 未使用インポートを残さない
- アプリをまたぐ import は禁止（`apps/web` から `apps/api/src` を import しない）

## コメント
- 公開関数には JSDoc で1行の日本語説明を付ける。`@param` / `@returns` は型と重複するため書かない
- 「なぜそうしたか」を書く。型を読めば分かることは書かない
