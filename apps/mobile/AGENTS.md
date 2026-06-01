# workout-habit mobile — 開発ガイド

筋トレの習慣化を支援する **オフライン完結型** モバイルアプリ。記録（種目・セット・重量・レップ）と
インターバルタイマーをローカル（端末内 SQLite）で扱い、サーバー連携は持たない。

## ⚠️ 最優先: Expo はバージョンで挙動が変わる

コードを書く前に、必ず **v56 系の versioned ドキュメント** を参照すること。
記憶やブログの一般論で書かない。

→ https://docs.expo.dev/versions/v56.0.0/

## 技術スタック

| 領域 | 採用 | 備考 |
|---|---|---|
| フレームワーク | Expo SDK 56 / React Native 0.85 | New Architecture（Fabric/TurboModules）が標準 |
| UI ランタイム | React 19 | |
| 言語 | TypeScript 6（strict） | `expo/tsconfig.base` を extends |
| ローカルDB | expo-sqlite | 8テーブル。マスタ（部位・種目）＋記録（workout/sets） |
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
| Exercise | 種目マスタの管理（カスタム種目追加・レスト設定） |

## 既知の課題: App.tsx の神ファイル化

`App.tsx` は約 **1,900行** に肥大化し、型定義・SQLite管理・状態・CRUD・10個の子コンポーネント・
150以上の StyleSheet が1ファイルに同居している。**段階的に下記の目標構成へ分割する**のが当面のゴール。

## 目標ディレクトリ構成（リファクタの到達点）

```
apps/mobile/
  src/
    types/        ドメイン型（Tab, BodyPart, Exercise, Workout, WorkoutSet …）と DB行型
    db/           schema.ts（テーブルDDL）, seed.ts（初期データ）, migrations/, queries.ts（CRUD）
    hooks/        useDatabase / useTimer / useWorkout など状態・副作用ロジック
    utils/        formatDate / formatTimer / estimateOneRepMax など純粋関数
    components/   TimerBanner / SetEditor / LabeledNumber / Metric など再利用UI
    screens/      HomeScreen / WorkoutScreen / HistoryScreen / ExerciseScreen
    styles/       共有テーマ（色・スペーシング）と画面別 StyleSheet の受け皿
  App.tsx         Provider・DB初期化・タブ切替のみの薄いシェル
```

DB行型（snake_case）とドメイン型（camelCase）は分離し、変換は `db/` の `toBodyPart` / `toExercise` /
`toWorkout` のような **変換関数に集約**する（型ガードの良例）。

## セッション開始時に読むルール（`.claude/rules/`）

実装・リファクタ前に必ず参照する。

- `project-structure.md` — 上記の目標構成と「新規ファイルをどこに置くか」の判断基準
- `code-design.md` — 神ファイル/神関数の閾値、DRY、マジック値、エラー処理のアンチパターン集
- `typescript.md` — `any`禁止・型ガード・命名規則
- `react-native.md` — コンポーネント/Hooks/StyleSheet/パフォーマンスの規約
- `data-persistence.md` — expo-sqlite のスキーマ・クエリ・マイグレーション規約

## 開発コマンド

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint（eslint-config-expo）
npm run format      # prettier --write
npm run ios         # 実機/シミュレータ実行（expo run:ios）
npm run start       # Metro 起動
```
