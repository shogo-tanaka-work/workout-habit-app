---
description: App.tsx から指定した画面/責務を目標構成へ安全に抽出する
argument-hint: "[抽出対象。例: HistoryScreen / useTimer / styles]"
---

App.tsx から **$ARGUMENTS** を `.claude/rules/project-structure.md` の目標構成へ抽出します。

## 抽出対象の現状

!`grep -n "$ARGUMENTS" App.tsx`

## 手順（依存の最下層から上へ）

`project-structure.md` の移行順序（types → utils → styles → db → hooks → components → screens）に従う。
抽出対象が依存する下位レイヤが未抽出なら、**先にそちらを移す**こと。

1. **読む**: 対象コードと、それが参照する型・utils・styles・db・hooks を `App.tsx` から特定する。
2. **下位を先に移設**: 対象が使う型 → `src/types/`、純粋関数 → `src/utils/`、StyleSheet → `src/styles/`、
   SQL/変換 → `src/db/` の順で、まだ移っていないものを移す。
3. **本体を移設**: 対象（コンポーネント or フック）を `src/screens/` or `src/hooks/` or `src/components/` に新規ファイルとして作る。
   - コンポーネントは props 型を同ファイルに `interface` 定義（`react-native.md`）
   - フックは state・副作用・公開API を明示
4. **import を整理**: `App.tsx` 側は抽出先から import する。バレルエクスポートは作らない（直接 import）。
5. **検証**: `npm run typecheck` を実行し緑を確認。続いて `npm run lint`。
6. **挙動不変の確認**: 抽出は **リファクタのみ**。ロジック・UIの振る舞いを変えない。差分が「移動 + import」に
   収まっているかセルフレビューする。

## 完了条件
- `npm run typecheck` 緑 / `npm run lint` 緑
- 抽出対象が `App.tsx` から消え、対応する `src/` 配下ファイルに移っている
- 機能の振る舞いに変化がない

設計の全体像が必要なら、先に `refactor-architect` サブエージェントで責務マッピングを作ってから着手すること。
