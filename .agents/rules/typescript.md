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

## `string` に何でも詰めない

意味の違う値をすべて `string` で表すと、取り違えてもコンパイラが気づけない。
**取りうる値が決まっているなら、そこまで狭める。**

```ts
// NG（どんな文字列でも通る。ID とラベルを取り違えても分からない）
const label = (status: string) => ...

// OK
type WorkoutStatus = 'planned' | 'active' | 'completed';
const label = (status: WorkoutStatus) => ...
```

- 区切り文字で複数の意味を詰め込んだ文字列（`"chest:bench-press:80"`）を作らない。
  値ごとにフィールドを持つ型にする
- 単位を持つ数値は名前で表す（`weightKg` / `restSeconds` / `durationMs`）。
  `weight` だけだと kg なのか lb なのか読めない

## 不正な値を作れなくする

`string` や `number` を裸で持ち回ると、**そもそも存在しえない値**を作れてしまう。
クラス（値オブジェクト）を使わない設計なので、代わりに次の3つで守る。

1. **取りうる値をリテラル型で狭める**（前節）
2. **単位・意味を名前に入れる**（`weightKg` / `restSeconds` / `durationMs`）
3. **作る場所を1か所にして、そこで検証する**

```ts
// NG（負の重量も、kg か lb か不明な値も作れる）
const addSet = (weight: number) => ...

// OK（作る入口で弾く。入口を通らない値は存在しない）
const toWeightKg = (input: number): number => {
  if (!Number.isFinite(input) || input < 0) {
    throw new Error(`重量が不正です: ${input}`);
  }
  return Math.round(input * 10) / 10;
};
```

検証を各所の `if` で繰り返すのではなく、**値を作る関数を通す**。
通っていない値がドメインへ入らない形にする。

## 動的なプロパティアクセスで型検査をすり抜けない

`obj[key]` や `as` を使った書き換えは、コンパイラの検査を無効にする。

- オブジェクトのキーを変数で引くときは、キーの型を `keyof` で縛る
- 設定値やマスタは `Record<string, T>` ではなく、キーを列挙した型にできないか先に考える
- **ビルド時に置換される値は静的に書く。** Expo の `process.env.EXPO_PUBLIC_X` は
  `process.env[key]` の動的アクセスでは置換されず、実行時に `undefined` になる

## 型で分岐する。値の型で分岐しない

`typeof` や `Array.isArray` での分岐は、**外部入力を検証する境界でだけ**使う。
ドメインのロジックで「値の形を調べて振る舞いを変える」書き方をしない。

```ts
// NG（呼び出し側が渡すものによって意味が変わる。増えるたびに全箇所へ分岐が増える）
const summarize = (input: WorkoutSet[] | Workout) => {
  if (Array.isArray(input)) { ... } else { ... }
};

// OK（引数の型を分け、関数を分ける）
const summarizeSets = (sets: WorkoutSet[]) => ...;
const summarizeWorkout = (workout: Workout) => ...;
```

## `null` と `undefined`

- **「値が無い」を表すのは `null` に寄せる。** `undefined` は「まだ設定していない」
  （オプショナルなプロパティ、省略された引数）に限る
- `null` を返す関数は、**呼び出し側が必ず分岐する**ことを前提にする。
  分岐を強いたくないなら既定値を返すか、例外にする
- **`null` を返す層を増やさない。** `A が null を返す → B も null を返す → C も…` と
  連鎖すると、どこで消えたのか追えなくなる。境界で埋めるか、そこで落とす
- 失敗の理由を伝えたいときは `null` ではなく判別できるユニオンを返す

## 小数は `number` のまま扱う。ただし丸める場所を決める

十進計算ライブラリ（Big.js 等）は入れない。このアプリが扱う値では実害が出ないため。

- プレート由来の重量（0.5 / 1.25 / 2.5 刻み）は**2進数で正確に表せる**ので誤差が出ない
- 端数のある重量を1000セット合計しても誤差は `2.3e-10` 程度で、表示の丸めに吸収される
- 金額を扱わない。1円のズレが問題になる場面が無い

代わりに**丸める場所を決める**。次の3点で丸め、途中では丸めない。

| 場所 | 規則 | 実装 |
|---|---|---|
| 入力 | ステッパー・テキスト確定時に小数2桁 | `LabeledNumber` の `Math.round(x * 100) / 100` |
| 換算 | 推定1RM は小数1桁、目安重量は 0.5kg 刻み | `utils/number.ts` の `estimateOneRepMax` / `weightForReps` |
| 表示 | 桁区切りと単位を付ける段階で整数化 | `utils/number.ts` の `formatCount` / `formatVolume` / `formatWeight` |

- **集計の途中では丸めない。** 合計してから表示時に丸める。途中で丸めると誤差が累積する
- `toFixed` / `toLocaleString` を各所で直接書かない。`utils/number.ts` を通す。
  例外は SVG の座標のように**表示する数値ではない**もの（`LineChart` のポリライン座標など）
- 比較に `===` を使う値は、丸めた後のものだけにする。
  生の計算結果どうしを等値比較しない（`0.1 + 0.2 !== 0.3`）

## 日付は文字列で持ち、`Date` は計算のときだけ使う

日付ライブラリ（Day.js 等）は入れない。扱うのが `YYYY-MM-DD` のローカル日付に
ほぼ限られ、ライブラリを入れても「月曜はじまり」などの規則は結局自分で書くため。

- **保存・受け渡し・比較は `YYYY-MM-DD` の文字列で行う。** この形式は辞書順が日付順と一致する
- `Date` を作るのは計算するときだけ。計算が終わったら文字列へ戻す
- **`new Date('YYYY-MM-DD')` を使わない。** UTC として解釈され、日本時間では前日になる。
  ローカル日付として扱うなら `new Date(year, month - 1, day)` で組み立てる
- **日付をずらすのに ms 加算（`+ days * 86_400_000`）を使わない。**
  夏時間のある地域で遷移日をまたぐと1日ずれる。`setDate(getDate() + days)` を使う
- 日付の規則（週の起点、期間の起点）は `utils/datetime.ts` に集約し、
  各画面で組み立てない

**同じ規則が apps 間に重複していることを忘れない。** 週の起点は
`apps/mobile/src/utils/datetime.ts` の `startOfWeekIso` と
`apps/api/src/analytics.ts` の `weekStartIso` に別実装がある。片方だけ変えると、
アプリが出す「今週」とサーバが出す「今週」がずれる。

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
