# workout-habit mobile — 開発ガイド

筋トレの習慣化を支援する **オフライン優先** のモバイルアプリ。記録（種目・セット・重量・レップ）と
インターバルタイマーを端末内 SQLite で扱い、ネットワークが無くてもすべての機能が動く。
クラウド（Cloudflare D1）へは `src/db/sync.ts` 経由の**任意バックアップ**として同期する。

## 開発ルール

コーディング規約はリポジトリルートの `.agents/` に集約している。実装前に読む。

- `.agents/AGENTS.md` — 入口。3アプリの責務境界とルール読み込み順
- `.agents/rules/mobile-react-native.md` — コンポーネント / Hooks / StyleSheet / パフォーマンス
- `.agents/rules/mobile-sqlite.md` — スキーマ・クエリ・マイグレーション・同期
- `.agents/rules/code-design.md`、`typescript.md`、`project-structure.md` — 全アプリ共通
- `.agents/DESIGN.md` — ビジュアルデザインの正本

`.claude/` には Claude Code 固有の commands / agents / settings を置く。

## ⚠️ 最優先: Expo はバージョンで挙動が変わる

コードを書く前に、必ず **v56 系の versioned ドキュメント** を参照すること。
記憶やブログの一般論で書かない。

→ https://docs.expo.dev/versions/v56.0.0/

## 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| フレームワーク | Expo SDK 56 / React Native 0.85 | New Architecture（Fabric/TurboModules）が標準 |
| UI ランタイム | React 19 | |
| 言語 | TypeScript（strict） | `expo/tsconfig.base` を extends |
| ローカルDB | expo-sqlite | 10テーブル。マスタ（部位・種目）＋記録（workout/sets）＋設定・ボディログ |
| 音声 | expo-audio | タイマー完了音（timer-complete.wav） |
| ピッカー | @react-native-picker/picker | レスト時間選択 |
| ナビゲーション | **自前の state 方式**（タブ4画面） | React Navigation / Expo Router は未導入 |
| 状態管理 | React 標準（useState / useMemo） | Zustand 等の外部ライブラリは未導入 |
| スタイル | StyleSheet | NativeWind 等は未導入 |

外部ライブラリの新規導入は方針判断が必要なため、勝手に追加しない。

## 画面構成（4タブ）

| タブ | 役割 |
|---|---|
| Home | きょうのワークアウト開始・進行状況 |
| Workout | 進行中ワークアウトの種目・セット入力、レストタイマー |
| History | 完了済みワークアウトの履歴・統計 |
| Exercise | 種目マスタの管理（カスタム種目追加・レスト設定）と種目別詳細 |

## ディレクトリ構成

```
apps/mobile/
  src/
    types/        domain.ts（ドメイン型）/ db.ts（SQLite 行型）
    db/           schema.ts / seed.ts / queries.ts / mappers.ts / sync.ts
    hooks/        useWorkoutData / useRestTimer
    utils/        datetime / format / number / aggregate / plates / calendar / csv / id
    components/   TimerBanner / SetEditor / SetTable / TrendChart / PlateCalculator ほか
    screens/      HomeScreen / WorkoutScreen / HistoryScreen / ExerciseScreen / ExerciseDetailScreen
    styles/       theme.ts（色・余白・フォント）/ appStyles.ts（共有 StyleSheet）
  App.tsx         DB初期化・タブ切替のみの薄いシェル
```

DB行型（snake_case）とドメイン型（camelCase）は分離し、変換は `db/mappers.ts` の
`toBodyPart` / `toExercise` / `toWorkout` に集約する。

## 開発コマンド

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint（eslint-config-expo）
npm run format      # prettier --write
npm run ios         # 実機/シミュレータ実行（expo run:ios）
npm run start       # Metro 起動
```
