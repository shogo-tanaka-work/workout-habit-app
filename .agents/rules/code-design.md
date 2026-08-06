---
paths: "**/*.ts,**/*.tsx"
---
# コード設計ルール（アンチパターン禁止集）

設計上の悪手を集約したルール。新規実装・リファクタ時に必ず参照する。
**OK例 / NG例** を併記しているので、判断に迷ったら照合する。

## 1. 神ファイル・神関数を作らない

| ルール | 閾値 |
|---|---|
| 1ファイルの行数 | 300行で分割を検討、500行で必ず分割 |
| 1関数の行数 | 50行で分割を検討、80行で必ず分割 |
| 1コンポーネント | 描画 / 状態 / 副作用 / スタイル定義 が同居したら分離 |
| 1関数・1コンポーネントの責務 | 「データ取得」「整形」「描画」を混在させない |

型・DB・状態・CRUD・UI・StyleSheet を1ファイルへ全部入れるのは禁止。
責務ごとのディレクトリへ分ける（[project-structure.md](project-structure.md)）。

## 2. 判定関数・述語の重複を作らない（DRY）

同じ構造の `isXxx` ヘルパーを並べない。**判定基準を引数で渡すファクトリ**にする。

### NG
```ts
const isChest = (part: BodyPart | null) => part?.id === 'chest';
const isBack  = (part: BodyPart | null) => part?.id === 'back';
// ...部位ごとに増殖
```

### OK
```ts
const matchPartId = (id: string) => (part: BodyPart | null): boolean => part?.id === id;
const isChest = matchPartId('chest');
```

## 3. マジックナンバー / マジックストリングを書かない

意味を持つリテラルは **名前付き定数 or ユーティリティ関数** に閉じ込める。

### NG
```ts
if (elapsedSec >= 90) { /* レスト終了？なぜ90？ */ }
const oneRepMax = weight * (1 + reps / 30);   // 30 とは？（Epley係数）
const day = iso.slice(8, 10);                 // 何番目？
```

### OK
```ts
const DEFAULT_REST_SECONDS = 90;
const EPLEY_DIVISOR = 30;                      // 1RM = w * (1 + reps/30)
const dayOf = (isoDate: string): number => Number(isoDate.slice(8, 10));
```

例外: ループ回数など文脈で自明なリテラル（`i < 3`）は許容。

## 4. 同じデータを何度もループしない

`sets.filter(...).length` を連続で並べると O(n) で済む集計が O(kn) になる。
カウンタが多い場合は単一ループでまとめる。

### NG
```ts
const completed = sets.filter((s) => s.completed).length;
const totalReps = sets.filter((s) => s.completed).reduce((a, s) => a + s.reps, 0);
const volume    = sets.filter((s) => s.completed).reduce((a, s) => a + s.reps * s.weight, 0);
```

### OK
```ts
let completedCount = 0, totalReps = 0, totalVolume = 0;
for (const set of sets) {
  if (!set.completed) continue;
  completedCount += 1;
  totalReps += set.reps;
  totalVolume += set.reps * set.weight;
}
```

## 5. 変数名の省略は禁止

スコープが短くても `s` / `r` / `w` / `e` のような1文字変数を使わない（型からの逆引きが手間）。

### NG
```ts
sets.map((s) => s.id)
const w = workouts.find((x) => x.id === id);
```

### OK
```ts
sets.map((set) => set.id)
const workout = workouts.find((candidate) => candidate.id === id);
```

慣用例外: `i, j`（ループindex）、`error`は省略しない、`_`（未使用引数）、`acc`（reduce）。

## 6. 型アサーション (`as`) / non-null assertion (`!`) の二重使用禁止

`row.weight! as number` のように `!` と `as` を重ねるのは型システムを2回欺いている。
**型ガード関数 + filter** で書き直す。詳細は [typescript.md](typescript.md) §型安全性。

## 7. エラーは必ず文脈を付けて投げる

SQLite や D1 のエラーをそのまま再throwすると、どの操作が失敗したか上位で分からない。

### NG
```ts
await db.runAsync(sql, params);   // 失敗時にどのクエリか不明
```

### OK
```ts
try {
  await db.runAsync(sql, params);
} catch (error) {
  throw new Error(`addSet failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
}
```

`cause` を使えば元エラーのスタックも保持される。

## 8. エラーを無言で握りつぶさない（catch でログ無しは禁止）

`catch` したエラーを **ログも出さず・throw もせず** デフォルト値返却で黙過するのは禁止。
障害時に「何が起きたか」がどこにも残らない。

### NG
```ts
try { await db.execAsync(ddl); } catch { /* 握りつぶし */ }
```

### OK
```ts
try {
  await db.execAsync(ddl);
} catch (error: unknown) {
  console.error('[db] schema 適用に失敗:', error);
  throw error;
}
```

許容される無言 catch: パースのフォールバックが目的で、後段で文脈付きエラーを throw している場合のみ。
判断基準は「その catch を通った事実が障害調査で必要になるか？」。

## 9. 共通ユーティリティを使う（ゼロ割を毎回手書きしない）

```ts
// NG
const avgVolume = setCount > 0 ? totalVolume / setCount : 0;
// OK（utils/number.ts）
export const safeDivide = (numerator: number, denominator: number, fallback = 0): number =>
  denominator > 0 ? numerator / denominator : fallback;
const avgVolume = safeDivide(totalVolume, setCount);
```

## 10. アプリ間の重複は許容し、境界は越えない

`apps/mobile/src/db/sync.ts` と `apps/api/src/tables.ts` のように、
同期対象テーブル定義がモバイルと API に重複する。これは**意図的に許容**する（共有パッケージを作らない）。

ただし片方だけ変えないこと。同期対象・カラム・レスポンス形状を変えたら、対になるファイルも同じ変更セットで直す。

---

## チェックリスト（実装後セルフレビュー）

- [ ] 1ファイル300行・1関数50行・1コンポーネントの責務過多になっていないか
- [ ] 同じ構造のヘルパー/述語を3つ以上並べていないか → ファクトリ化
- [ ] マジックナンバー・マジックストリングを直書きしていないか
- [ ] `filter().length` 等を同データに対し3つ以上連発していないか
- [ ] 1文字省略変数を使っていないか（慣用例外を除く）
- [ ] `as` と `!` を同じ式で併用していないか
- [ ] 外部エラーを文脈なしで再throw、または無言で握りつぶしていないか
- [ ] アプリ間で対になる定義を片方だけ変えていないか
