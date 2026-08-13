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

## 型で「ありえない状態」を作れなくする

**検査で防ぐより、そもそも書けなくするほうが強い。**
組み合わせが不正になり得るフィールドを並べず、判別できるユニオン型にする。

```ts
// NG（ok なのに error が入る、ok でないのに value が入る、を型が許してしまう）
type Result = { ok: boolean; value?: Operation; error?: string };

// OK（判別プロパティで分ける。ok が true なら value は必ずある）
type ParsedOperation =
  | { ok: true; operation: SyncOperation }
  | { ok: false; id: string | null; error: string };
```

この形にすると、`if (!parsed.ok) return parsed;` の後で `parsed.operation` が
存在することをコンパイラが保証する。**存在チェックを二重に書く必要がなくなる。**

union で分岐するときは `never` で網羅を検査する。分岐を足し忘れるとコンパイルエラーになる。

```ts
const label = (status: WorkoutStatus): string => {
  switch (status) {
    case 'planned': return '予定';
    case 'active': return '記録中';
    case 'completed': return '完了';
    default: {
      const unreachable: never = status;   // status が増えるとここで落ちる
      return unreachable;
    }
  }
};
```

## `interface` と `type` の使い分け

このリポジトリは **`type` を既定**とする。ドメイン型はユニオンや交差を使うことが多く、
`type` のほうが素直に書けるため。

- `type` … ドメイン型、ユニオン、関数型、props（既定）
- `interface` … 宣言のマージが要るとき（外部ライブラリの型拡張など）

**「interface を使えば型チェックが強くなる」ということはない。** どちらも同じ検査を受ける。
強くなるのは、`boolean` の組み合わせをユニオンへ置き換えたときや、
`string` を狭いリテラル型にしたときなど、**表現できる値を減らしたとき**だけ。

```ts
// 弱い（どんな文字列でも入る）
const rmDivisorFor = (exerciseId: string) => ...

// 強い（種目 ID の集合が決まっているなら、そこへ狭める）
type PresetExerciseId = 'bench-press' | 'squat' | 'deadlift';
```

ただし**狭めた型が外部入力に接するときは、境界で検証してから流す**。
外から来る値をリテラル型として受け取るのは、検証を飛ばしているのと同じ。

## 関数設計
- 純粋関数を優先し、副作用（DB・タイマー・通知・fetch）を分離する
- 早期リターンでネストを浅く保つ（[code-design.md](code-design.md)）
- 引数は4つを超えたら名前付きオブジェクト引数にする。真偽値のフラグ引数は作らない
- コールバックのネストは避け、async/await で書く
- Promise を浮かせない。`await` / `return` / `ctx.waitUntil()` のいずれかで追跡する
- 戻り値で状態を表すときは、`null` と例外の使い分けを決めておく。
  **「見つからない」は `null`、「呼び出し方が誤っている」は例外**

## エラー処理

詳細は [error-handling.md](error-handling.md)。型の観点では次を守る。

- catch した値は `unknown` として受け、`instanceof Error` で型ガードする
- 元エラーを残すときは `Error` の `cause` を使う
- エラーを戻り値で表す場合は判別できるユニオンにする（`{ ok: false; error: string }`）。
  `null` を返して呼び出し側に理由を推測させない

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
