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

**行数の閾値は「読む単位が混ざっているか」を測る代理指標であって、目的ではない。**
同じ形の定義が並ぶだけのファイルは対象外とする。

- `apps/mobile/src/styles/appStyles.ts` — スタイル定義の集約。分割すると
  「どこに定義されているか」を探す手間が増え、重複したスタイルが生まれやすくなる
- `apps/mobile/src/db/seed.ts`、`apps/api/src/tables.ts` — 同型のデータ定義が並ぶファイル

逆に、**責務が混ざったまま大きいファイルは閾値以下でも分割する**。

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

## 9. 車輪の再発明をしない（書く前に `utils/` を見る）

**新しい関数を書く前に、対象アプリの `utils/` に同じものが無いか確認する。**
特に日付・数値の整形、記録データの辿り方は既にある。

判断の順番:

1. `utils/` に同じ処理があるか → あればそれを使う
2. 無いが、**同じ式を3箇所以上で書くことになるか** → `utils/` へ出す
3. その画面でしか意味を持たない計算か → その場に書いてよい

### 標準メソッドを包まない。包むのは「規則」だけ

`sort` や `filter` の呼び出し方を短くするだけの関数を作らない。
**抽象化は情報を隠す代わりに意味を与える取引**で、意味を与えられないなら隠した分だけ損をする。

```ts
// NG（式を見れば昇順と分かるのに、定義へジャンプしないと昇順か降順かも分からなくなる）
const byOrderIndex = (a, b) => a.orderIndex - b.orderIndex;
items.sort(byOrderIndex);

// OK（その場で読める）
items.sort((a, b) => a.orderIndex - b.orderIndex);
```

包む価値があるのは、**各所が勝手に決めると食い違う規則**のほう。

```ts
// OK（未知IDのときに何を出すかは仕様。画面ごとに決めさせない）
export const exerciseNameOf = (exerciseId: string, exerciseById: Map<string, Exercise>): string =>
  exerciseById.get(exerciseId)?.name ?? '種目';
```

| 対象 | 例 | 判断 |
|---|---|---|
| 標準1メソッド＋自明な述語 | `sort((a, b) => a.x - b.x)` | 包まない |
| 標準の連鎖だが、その場で読める | 1つの親IDでセットを絞る | 包まない |
| 各所が勝手に決めると食い違う規則 | 未知IDのフォールバック、丸め方、1RMの除数 | **必ず包む** |
| 階層をまたぐ辿り方 | ワークアウト→種目行→セット | 包んでよい |

**名前が処理内容より多くを語れないなら、包まない。** `setsOf(id, sets)` は
「取る」としか言っておらず、並び順が保証されるかも読めない。そういう名前しか付かないなら、
それは共通化する単位が間違っている合図。

### `utils/` を肥大化させない分け方

「巨大ファイルを作らない」（§1）と矛盾させないために、**扱う対象で分ける**。
1ファイルに雑多な関数を集めた `helpers.ts` や `common.ts` を作らない。

| ファイル | 扱う対象 |
|---|---|
| `datetime.ts` | 日付・時刻の変換と表記 |
| `number.ts` | 数値の整形と換算 |
| `format.ts` | 時間の表示（`0:90` のようなタイマー表記） |
| `workoutTree.ts` | ワークアウト→種目行→セットの階層を辿る（表示順・名前の解決） |
| `aggregate.ts` | 集計（合計・最大・部位別・期間別） |
| `calendar.ts` / `calendarMarks.ts` | カレンダーの升目とマーク |

**対象で区切れているうちは、行数が増えても分割しない。** 逆に、区切りに収まらない
関数が出てきたら、それは新しい対象が現れた合図なのでファイルを足す。

## 10. アプリ間の重複は許容し、境界は越えない

次の3組は、モバイルと API に同じ知識が重複している。これは**意図的に許容**する（共有パッケージを作らない）。

| 内容 | mobile | api |
|---|---|---|
| 同期対象のテーブルと列 | `src/db/syncTables.ts` の `SYNC_COLUMNS` | `src/tables.ts` の `SYNC_TABLES` |
| 推定1RM の除数（BIG3 は FWJ の換算表） | `src/utils/oneRepMax.ts` | `src/analytics.ts` の `rmDivisorSql` |
| 共有プリセット種目 | `src/db/seed.ts` の `seedExercises` | D1 の `exercises`（`owner_user_id IS NULL`） |

ただし片方だけ変えないこと。同期対象・カラム・レスポンス形状・換算式・種目を変えたら、
対になるファイルも同じ変更セットで直す。

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
- [ ] 既に `utils/` にある処理を、画面やコンポーネントで書き直していないか
- [ ] 同じ「規則」を3箇所以上へ広げていないか（フォールバック・丸め方・換算式は特に）
- [ ] 標準メソッドの呼び出し方を短くするだけの関数を作っていないか
