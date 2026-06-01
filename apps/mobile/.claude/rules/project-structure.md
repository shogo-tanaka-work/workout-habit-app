---
paths: "**/*.ts,**/*.tsx"
---
# プロジェクト構成ルール

`App.tsx` 一極集中（神ファイル）から、責務ごとのディレクトリ分割へ移行する。
これは [code-design.md](code-design.md) §1 の具体化であり、リファクタの到達点。

## 目標構成

```
apps/mobile/
  src/
    types/        ドメイン型（BodyPart, Exercise, Workout, WorkoutSet, Timer …）と DB行型
    db/           schema.ts / seed.ts / migrations/ / queries.ts（CRUD・変換関数）
    hooks/        useDatabase / useTimer / useWorkout … 状態＋副作用ロジック
    utils/        formatDate / formatTimer / estimateOneRepMax … 純粋関数のみ
    components/   TimerBanner / SetEditor / LabeledNumber / Metric … 再利用UI
    screens/      HomeScreen / WorkoutScreen / HistoryScreen / ExerciseScreen
    styles/       theme.ts（色・余白・フォント）と画面別 StyleSheet
  App.tsx         Provider・DB初期化・タブ切替のみの薄いシェル
```

## 新規ファイルをどこに置くか（判断基準）

| 置くもの | 行き先 |
|---|---|
| 型定義（interface / type / union） | `types/` |
| SQL・テーブル定義・CRUD・行→ドメイン変換 | `db/` |
| `use` で始まる状態/副作用ロジック | `hooks/` |
| 副作用のない純粋関数（整形・計算） | `utils/` |
| 複数画面で使う表示部品 | `components/` |
| 1タブ＝1画面の構成部品 | `screens/` |
| StyleSheet・テーマ定数 | `styles/` |

迷ったら「副作用があるか？」「再利用されるか？」で振り分ける。
画面固有で再利用しない小部品は、その screen ファイル内に閉じてよい。

## 依存方向のルール
- `utils/` `types/` は他に依存しない（最下層・純粋）
- `db/` は `types/` に依存してよい
- `hooks/` は `db/` `utils/` `types/` に依存してよい
- `components/` `screens/` は上記すべてに依存してよいが、`screens/` 同士は依存しない
- 逆方向（`utils/` が `components/` を import 等）は禁止

## バレルエクスポートを避ける
`index.ts` での再エクスポート集約は、React Native の Fast Refresh を壊しやすく循環参照も招く。
各モジュールから直接 import する。

## 段階的移行の順序
依存の最下層から上へ。各段階で `npm run typecheck` を緑に保つこと。

1. `types/`（型を移設）
2. `utils/`（純粋関数を移設）
3. `styles/`（StyleSheet を移設）
4. `db/`（schema / seed / queries を移設）
5. `hooks/`（DB・タイマー・ワークアウトのロジックを抽出）
6. `components/` → `screens/`（UIを抽出）
7. `App.tsx` を薄いシェルに

詳しい抽出手順は `/refactor-screen` コマンドを使う。
