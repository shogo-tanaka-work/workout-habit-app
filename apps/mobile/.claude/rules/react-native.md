---
paths: "**/*.tsx"
---
# React Native / Expo コーディングルール

対象: Expo SDK 56 / React Native 0.85 / React 19。New Architecture が標準。
**コードを書く前に v56 の versioned ドキュメント（https://docs.expo.dev/versions/v56.0.0/）を参照する。**

## コンポーネント設計
- 1コンポーネント = 単一責任。300行を超えたら分割する
- props 型は同ファイルに `interface` で定義する
- デフォルトエクスポートは画面（screen）のみ。共有コンポーネントは名前付きエクスポート
- 1ファイルに複数の画面・コンポーネントをベタ書きしない（`App.tsx` の反例を踏襲しない）
- 表示専用（presentational）と状態保持（container）を意識して分ける

## Hooks / 状態
- ローカル状態は `useState`、派生値は `useMemo`、コールバックは `useCallback`
- 状態と副作用が絡むロジックは **カスタムフック（`useXxx`）に抽出**して `hooks/` に置く
  （例: DB初期化 → `useDatabase`、レストタイマー → `useTimer`、進行中ワークアウト → `useWorkout`）
- 不要な `useEffect` を増やさない。propsやstateから計算できる値は `useMemo` で導出する
- 外部ライブラリ（Zustand 等）の新規導入は方針判断が必要。勝手に追加しない（現状は React 標準のみ）

## useEffect のクリーンアップ必須
タイマー・購読・イベントリスナは **必ずクリーンアップ関数を返す**。返し忘れはリーク・多重発火の原因。

### NG
```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  // クリーンアップなし → アンマウント後も発火
}, []);
```

### OK
```tsx
useEffect(() => {
  const intervalId = setInterval(tick, 1000);
  return () => clearInterval(intervalId);
}, [tick]);
```

依存配列は正確に（`react-hooks/exhaustive-deps` に従う）。

## スタイリング
- `StyleSheet.create` を使い、定義は `styles/` または各コンポーネント末尾に集約する
- **インライン style（`style={{ ... }}`）でのレイアウト定義は禁止**（再生成でパフォーマンス劣化）
  動的値のみインラインを許容（例: `style={[styles.bar, { width: progress }]}`）
- 色・スペーシング・フォントサイズは `styles/theme.ts` の定数を参照（マジック値禁止）
- NativeWind 等のスタイルライブラリは未導入。導入は方針判断が必要

## リスト・描画パフォーマンス
- リストの `key` は安定した一意ID（配列 index を key にしない）
- 長いリストは `FlatList` を使い、`map` で全件描画しない
- 重い子コンポーネントは `React.memo` を検討する

## Platform 差異
- iOS/Android 差は `Platform.select({ ios, android, default })` で吸収する
- ネイティブ機能（audio・通知・触覚）はエラーになり得るため try-catch + ログ

## ナビゲーション（現状）
- React Navigation / Expo Router は未導入。タブ切替は **現行の state 方式**（`tab` state）を踏襲する
- ルーティングライブラリ導入は別途方針判断する
