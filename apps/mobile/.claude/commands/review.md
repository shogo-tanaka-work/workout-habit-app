---
description: 現在の変更をリポジトリルートの .agents/rules に照らしてレビューする
---

## 変更ファイル一覧

!`git status --short`

## 差分詳細（コミット済み + 作業ツリー）

!`git diff HEAD`

## レビュー観点

上記の変更を `.agents/rules/` の規約に照らしてレビューしてください。観点:

### 1. 構造・設計（`code-design.md` / `project-structure.md`）
- 神ファイル/神関数の再発（1ファイル300行・1関数50行超、コンポーネントへの責務同居）
- 配置の妥当性（型→types、SQL/変換→db、useXxx→hooks、純粋関数→utils、StyleSheet→styles）
- 依存方向違反（下位レイヤが上位を import していないか）

### 2. TypeScript（`typescript.md`）
- `any` の使用、`as` と `!` の併用
- DB行型とドメイン型の混同（変換関数を通しているか）
- 1〜2文字の省略変数名

### 3. React Native（`mobile-react-native.md`）
- `useEffect` のクリーンアップ漏れ（タイマー・audio・購読）
- 依存配列の漏れ、リスト key への index 使用
- インライン style でのレイアウト定義

### 4. expo-sqlite（`mobile-sqlite.md`）
- パラメータの `?` バインド、`SELECT *` の濫用
- DB エラーの握りつぶし・文脈なし再throw
- シードの冪等性

具体的なファイル名・行番号・修正案、該当する rules ファイル名を添えてフィードバックしてください。
深掘りが必要なら `code-reviewer` サブエージェントに委譲してください。
