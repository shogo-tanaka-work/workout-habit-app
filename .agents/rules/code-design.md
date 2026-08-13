---
paths: "**/*.ts,**/*.tsx"
---
# コード設計ルール

新規実装・リファクタ時に必ず参照する。**OK例 / NG例** を併記しているので、判断に迷ったら照合する。

エラーとログは [error-handling.md](error-handling.md)、型の使い方は [typescript.md](typescript.md)、
置き場所は [project-structure.md](project-structure.md) にある。

## 判断の順番

設計で迷ったら、この順で満たす。**上位を下位のために犠牲にしない。**

1. **正しく動くか**
2. **他人が読んで分かるか**
3. **変えたいときに変えられるか**

3 のためだけに 2 を捨てない。「将来こう拡張するかもしれない」で今読めないコードを書くのは、
起きていない問題のために確実な損を払う取引になる。

抽象化は**情報を隠す代わりに意味を与える取引**である。意味を与えられない抽象化は、
隠した分だけ損をする。

## 神ファイル・神関数を作らない

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

## 関心の分離

1つの関数・モジュールが答える問いを1つにする。次が混ざっていたら分ける。

| 関心 | 例 |
|---|---|
| 取得 | DB から読む、API を叩く |
| 判断 | 条件を満たすか、どれを選ぶか |
| 計算 | 集計する、換算する |
| 整形 | 表示用の文字列にする |
| 描画 | 画面に出す |

判断の目安は「**この関数が変わる理由はいくつあるか**」。2つ以上なら分ける。
表示の都合で計算が変わる、DB のカラム名でラベルが変わる、といった状態は分離できていない。

## 高凝集・低結合

- **凝集**: 一緒に変わるものを同じ場所へ置く。同じデータを扱う計算が3か所に散っていたら低凝集
- **結合**: モジュールが相手の**内部の作り**を知らないようにする。
  知ってよいのは「何を渡すと何が返るか」だけ

```ts
// NG（呼ぶ側がデータ構造の辿り方まで知っている＝密結合）
const volume = workout.exercises.flatMap((e) => e.sets).reduce((sum, s) => sum + s.weightKg * s.reps, 0);

// OK（何を渡すと何が返るかだけを知っている）
const volume = summarizeSets(sets).totalVolume;
```

**高凝集を狙って密結合になる**ことがある。「関連しそうだから」と1か所へ集めた結果、
無関係な変更が互いに影響し合う状態がそれ。凝集は「一緒に**変わる**か」で判断し、
「似ている」で判断しない。

## 引数

- **4つを超えたらオブジェクト引数にする。** 位置引数が並ぶと、呼び出し側で順番を間違えても
  型が同じなら気づけない
- **同じ型の引数を並べない。** `move(fromId, toId)` のような並びは取り違える。
  順序に意味があるならオブジェクトにして名前を付ける
- **真偽値のフラグ引数を作らない。** `save(data, true)` は呼び出し側から意味が読めない。
  振る舞いが2つあるなら関数を2つに分ける

```ts
// NG
const load = (id: string, includeArchived: boolean, withSets: boolean) => ...
load('x', true, false);   // 呼び出しを見ても何が起きるか分からない

// OK
const loadExercise = (id: string) => ...
const loadArchivedExercise = (id: string) => ...
```

## 分岐

### 早期リターンでネストを浅くする

ネストは3段までを目安にする。深くなるのは、**判断と処理が同じ関数にある**合図。

```ts
// NG
if (workout) {
  if (workout.status === 'active') {
    if (sets.length > 0) {
      // 本題
    }
  }
}

// OK
if (!workout) return null;
if (workout.status !== 'active') return null;
if (sets.length === 0) return null;
// 本題
```

### 条件式に名前を付ける

条件が2つ以上組み合わさったら、変数か関数に切り出して**何を判断しているか**を書く。

```ts
// NG
if (set.weightKg > 0 && set.reps > 0 && !set.isWarmup && set.deletedAt === null) { ... }

// OK
const countsTowardVolume =
  set.weightKg > 0 && set.reps > 0 && !set.isWarmup && set.deletedAt === null;
if (countsTowardVolume) { ... }
```

### 同じ分岐を各所へ広げない

同じ `switch` や `if` の並びが2か所以上に現れたら、**データか型で表す**。
分岐を書き足すのではなく、テーブルを引く形にする。

```ts
// NG（種目が増えるたびに全箇所へ case を足す）
switch (exerciseId) {
  case 'bench-press': return 40;
  case 'squat': return 33.3;
  default: return 30;
}

// OK（対応表を1か所に持つ）
const DIVISOR_BY_EXERCISE_ID = new Map([...]);
export const rmDivisorFor = (id: string) => DIVISOR_BY_EXERCISE_ID.get(id) ?? EPLEY_DIVISOR;
```

union 型で分岐するときは `never` で網羅を検査する（[typescript.md](typescript.md)）。

## 判定関数・述語の重複を作らない（DRY）

同じ構造の `isXxx` ヘルパーを並べない。**判定基準を引数で渡すファクトリ**にする。

```ts
// NG
const isChest = (part: BodyPart | null) => part?.id === 'chest';
const isBack  = (part: BodyPart | null) => part?.id === 'back';
// ...部位ごとに増殖

// OK
const matchPartId = (id: string) => (part: BodyPart | null): boolean => part?.id === id;
const isChest = matchPartId('chest');
```

**DRY は「知識の重複を避ける」であって「同じ文字列を消す」ではない。**
形が同じでも変更理由が違うなら、別物として放置する。無関係な2か所を1つにまとめると、
片方の都合で相手が壊れる。

## マジックナンバー / マジックストリングを書かない

意味のある値には名前を付け、定数として1か所に置く。
「なぜその値か」が自明でないものはコメントで理由を書く。

## 同じデータを何度もループしない

同じ配列に対して `filter().length` や `reduce` を3つ以上並べたら、1回のループでまとめる。
集計は `utils/aggregate.ts` のような純粋関数へ寄せ、画面では結果だけを使う。

## 命名

**名前は「何をするか」ではなく「何のためにあるか」を表す。**

- 関数は**動詞＋目的語**にする（`summarizeSets` / `estimateOneRepMax` / `buildWorkoutCsv`）。
  `process` `handle` `manage` `check` のような、何をするか分からない動詞を単独で使わない
- 真偽値は `is` / `has` / `can` で始める（`isWarmup` / `hasActiveWorkout`）
- **技術用語で名付けない。** `Manager` `Util` `Helper` `Info` `Data` `Common` は、
  中身の説明を放棄した名前で、何でも入る器になる。扱う対象で名付ける
- **省略しない。** `status` `row` `query` と完全形で書く。
  例外は `i` / `j`（ループ index）、`_`（未使用引数）、`acc`（reduce）
- 名前と中身がずれたら、**名前ではなく中身を疑う**。
  「この関数、名前を付けにくい」は責務が混ざっている合図

## 型アサーション (`as`) / non-null assertion (`!`) の二重使用禁止

`row.weight! as number` のように `!` と `as` を重ねるのは型システムを2回欺いている。
**型ガード関数 + filter** で書き直す。詳細は [typescript.md](typescript.md)。

## 可変なモジュールスコープを持たない

モジュールの先頭で宣言した変数を、関数の中から書き換えない。

- **Workers**: インスタンスが複数リクエストで再利用される。
  リクエスト固有の値を置くと、他人のデータが混ざる
- **React Native**: 画面をまたいで残り、リロードでしか消えない状態になる。
  再現しない不具合の温床

状態は React の state か、引数で受け渡す。再代入しない定数は置いてよい。

## 車輪の再発明をしない（書く前に `utils/` を見る）

**新しい関数を書く前に、対象アプリの `utils/` に同じものが無いか確認する。**
特に日付・数値の整形、記録データの辿り方は既にある。

判断の順番:

1. `utils/` に同じ処理があるか → あればそれを使う
2. 無いが、**同じ規則を3箇所以上で書くことになるか** → `utils/` へ出す
3. その画面でしか意味を持たない計算か → その場に書いてよい

### 標準メソッドを包まない。包むのは「規則」だけ

`sort` や `filter` の呼び出し方を短くするだけの関数を作らない。

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

「巨大ファイルを作らない」と矛盾させないために、**扱う対象で分ける**。
1ファイルに雑多な関数を集めた `helpers.ts` や `common.ts` を作らない。

| ファイル | 扱う対象 |
|---|---|
| `datetime.ts` | 日付・時刻の変換と表記 |
| `number.ts` | 数値の整形と換算 |
| `format.ts` | 時間の表示（`0:90` のようなタイマー表記） |
| `workoutTree.ts` | ワークアウト→種目行→セットの階層を辿る |
| `aggregate.ts` | 集計（合計・最大・部位別・期間別） |
| `calendar.ts` / `calendarMarks.ts` | カレンダーの升目とマーク |

**対象で区切れているうちは、行数が増えても分割しない。** 逆に、区切りに収まらない
関数が出てきたら、それは新しい対象が現れた合図なのでファイルを足す。

## 不変を既定にする

**JavaScript の配列メソッドには、元の配列を壊すものがある。**
`sort` / `reverse` / `splice` / `push` / `pop` / `shift` / `unshift` / `fill` がそれ。

props や引数で受け取った配列をそのまま `sort` すると、**呼び出し元のデータが変わる**。
React では「変えたはずのない場所の表示が変わる」「再レンダリングされない」という形で出る。

```ts
// NG（引数の配列を壊す。呼び出し元の並び順が変わる）
const latest = (workouts: Workout[]) => workouts.sort((a, b) => ...)[0];

// OK（複製してから並べ替える）
const latest = (workouts: Workout[]) => [...workouts].sort((a, b) => ...)[0];

// OK（filter / map は新しい配列を返すので、その後の sort は安全）
const sets = allSets.filter((set) => set.workoutExerciseId === id).sort((a, b) => ...);
```

- **引数を書き換えない。** 受け取ったオブジェクト・配列は読むだけにする
- 変更したいときは新しい値を作って返す（`{ ...current, name }` / `[...items, next]`）
- 読み取り専用で受けたい配列の型は `readonly T[]` にする

## 取得と変更を混ぜない（コマンド・クエリ分離）

**値を返す関数は状態を変えない。状態を変える関数は値を返さない。**
「取得したつもりが保存もしていた」は追いにくい不具合になる。

```ts
// NG（名前は取得だが、ついでに保存している）
const getActiveWorkout = async () => {
  const workout = await findActive();
  await touchWorkout(workout.id);   // 副作用
  return workout;
};

// OK（分ける）
const findActiveWorkout = async () => ...;
const touchWorkout = async (workoutId: string) => ...;
```

例外は「作って返す」操作（`insertWorkout` が作成した ID を返すなど）。
その場合は名前で作成だと分かるようにする。

## 結果を返すために引数を使わない

引数として渡したオブジェクトへ書き込んで結果を伝える形にしない。
呼び出し側から見て、どれが入力でどれが出力か読めなくなる。

```ts
// NG
const summarize = (sets: WorkoutSet[], result: SetSummary): void => { result.totalVolume = ...; };

// OK
const summarize = (sets: WorkoutSet[]): SetSummary => ({ totalVolume: ..., ... });
```

## 深く辿らない（デメテルの法則）

**知ってよいのは「自分が受け取ったもの」と「その1階層先」まで。**
`a.b.c.d` のように連鎖して辿ると、途中の構造が変わるたびに壊れる。

```ts
// NG（呼ぶ側が3階層の構造を知っている）
const name = workout.exercises[0].exercise.name;

// OK（必要な値を受け取るか、辿り方を1か所へ寄せる）
const name = exerciseNameOf(item.exerciseId, exerciseById);
```

`?.` を連ねたくなったら、それは辿りすぎの合図。

## コレクション操作

- **自前でループを組む前に、標準メソッド（`filter` / `map` / `some` / `find` / `reduce`）で書けないか見る。**
  「n 件目を探す」「条件に合うものだけ集める」を `for` と添字で書かない
- **ループの中で `if` をネストさせない。** 早期 `continue` で浅くする

```ts
// NG
for (const set of sets) {
  if (!set.isWarmup) {
    if (set.deletedAt === null) {
      total += set.weightKg * set.reps;
    }
  }
}

// OK
for (const set of sets) {
  if (set.isWarmup) continue;
  if (set.deletedAt !== null) continue;
  total += set.weightKg * set.reps;
}
```

- 同じコレクションを何度も走査するなら、1回のループにまとめる（`summarizeSets` のように）

## 生成の入口を1つにする

同じ種類のデータを作る手順が各所に散ると、**片方だけ初期値を直し忘れる**。
新しい行を作る処理は1か所へ寄せ、ID の発番・既定値・タイムスタンプをそこで済ませる。

```ts
// NG（画面ごとに newId して既定値を並べる。既定値が食い違う）
await insertWorkoutSet(db, { id: newId('set'), rpe: 0, isWarmup: false, ... });

// OK（作る手順を1か所に持つ）
await addSet(workoutExercise);
```

## デッドコードを残さない

- どこからも呼ばれない関数・到達しない分岐・使われない props は、見つけた時点で消す
- **「そのうち使うかもしれない」で残さない。** 必要になったら履歴から戻せる
- コメントアウトしたコードを残さない。何が正しいのか読む人に分からなくなる

## 名前と居場所を一致させる

関数の名前が、置いてあるファイルの対象と合っているか確かめる。

- `datetime.ts` に種目の話が出てくる、`aggregate.ts` に表示文言が出てくる、といった状態は
  置き場所が違う合図
- 「この関数、どこに置けばいいか分からない」ときは、**関数の責務が複数ある**ことが多い

## アプリ間の重複は許容し、境界は越えない

次の3組は、モバイルと API に同じ知識が重複している。これは**意図的に許容**する（共有パッケージを作らない）。

| 内容 | mobile | api |
|---|---|---|
| 同期対象のテーブルと列 | `src/db/syncTables.ts` の `SYNC_COLUMNS` | `src/tables.ts` の `SYNC_TABLES` |
| 推定1RM の除数（BIG3 は FWJ の換算表） | `src/utils/oneRepMax.ts` | `src/analytics.ts` の `rmDivisorSql` |
| 共有プリセット種目 | `src/db/seed.ts` の `seedExercises` | D1 の `exercises`（`owner_user_id IS NULL`） |

ただし片方だけ変えないこと。同期対象・カラム・レスポンス形状・換算式・種目を変えたら、
対になるファイルも同じ変更セットで直す。

## 過剰な設計をしない

- **使う予定が今ないものを作らない。** 「後で必要になるかも」の設定・オプション・抽象層は、
  必要になった時点で足す。使われないコードは読む人の負担にしかならない
- **1つのパターンを万能薬にしない。** ある場所で効いた設計を、状況の違う場所へ機械的に
  当てはめない。設計は文脈に依存する
- **ライブラリの新規導入は方針判断が必要。** 勝手に追加しない（各アプリの `AGENTS.md`）

## チェックリスト（実装後セルフレビュー）

- [ ] 1ファイル300行・1関数50行・1コンポーネントの責務過多になっていないか
- [ ] この関数が変わる理由は1つに保たれているか
- [ ] 呼ぶ側が相手の内部構造を辿っていないか（密結合）
- [ ] 引数が4つを超えていないか。フラグ引数を足していないか
- [ ] ネストが3段を超えていないか。早期リターンで浅くできないか
- [ ] 同じ分岐を2か所以上へ広げていないか（データか型で表せないか）
- [ ] 同じ構造のヘルパー/述語を3つ以上並べていないか → ファクトリ化
- [ ] マジックナンバー・マジックストリングを直書きしていないか
- [ ] `filter().length` 等を同データに対し3つ以上連発していないか
- [ ] 関数名が動詞＋目的語になっているか。`Util` `Manager` `Data` で名付けていないか
- [ ] 1文字省略変数を使っていないか（慣用例外を除く）
- [ ] `as` と `!` を同じ式で併用していないか
- [ ] モジュールスコープの変数を書き換えていないか
- [ ] 既に `utils/` にある処理を、画面やコンポーネントで書き直していないか
- [ ] 標準メソッドの呼び出し方を短くするだけの関数を作っていないか
- [ ] 受け取った配列を `sort` などで壊していないか（`[...items].sort()` になっているか）
- [ ] 値を返す関数が、ついでに状態を変えていないか
- [ ] `a.b.c.d` のように深く辿っていないか
- [ ] ループの中で `if` をネストさせていないか（早期 continue で浅くできないか）
- [ ] 到達しないコード・コメントアウトしたコードを残していないか
- [ ] 関数の名前が、置いてあるファイルの対象と合っているか
- [ ] 今は使わない拡張ポイントを足していないか
- [ ] アプリ間で対になる定義を片方だけ変えていないか
