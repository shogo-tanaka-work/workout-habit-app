---
paths: "apps/mobile/**/*.tsx,apps/mobile/**/*.ts"
---
# React Native / Expo コーディングルール

対象: Expo SDK 56 / React Native 0.85 / React 19。New Architecture が標準。

**コードを書く前に v56 の versioned ドキュメント（https://docs.expo.dev/versions/v56.0.0/）を参照する。**
Expo はバージョンで挙動が変わる。記憶やブログの一般論で書かない。

## ⚠️ リポジトリの絶対パスは ASCII のみ

このリポジトリを日本語などマルチバイト文字を含むディレクトリへ置くと **iOS ビルドが必ず失敗する**。

React Native 0.85 は React Core をプリビルド tarball で取得する。その処理
（`node_modules/react-native/scripts/cocoapods/rncore.rb` と `rndependencies.rb`）が
ローカル保存先から `file://` URI を組み立てるが、Ruby の `URI` は非 ASCII を受け付けず
`URI::InvalidComponentError: bad component` を投げる。例外は `rescue` で握りつぶされて
podspec の `source` が未設定になり、`pod install` が
`The React-Core-prebuilt pod failed to validate: Missing required attribute source` で落ちる。

ホームディレクトリからプロジェクトまでの**全階層**が ASCII である必要がある。
末端のディレクトリ名だけ英語にしても、親に日本語が残っていれば同じ結果になる。

パスを変えずに回避するなら `ios/Podfile.properties.json` へ
`"ios.buildReactNativeFromSource": "true"` を足して React Native をソースからビルドできるが、
ビルド時間が大幅に伸びるため、ASCII パスへ置くことを既定とする。

リポジトリを移動したら `ios/Pods` と `ios/build` を作り直してから `npx pod-install` する。
CocoaPods が生成する `ios/Pods/Target Support Files/**/*.xcconfig` には
`-ivfsoverlay` の絶対パスが焼き込まれており、移動しただけでは古いパスを指し続ける。
DerivedData を消しても供給源が残るため直らない。

## コンポーネント設計
- 1コンポーネント = 単一責任。300行を超えたら分割する
- props 型は同ファイルに `interface` で定義する
- デフォルトエクスポートは画面（screen）のみ。共有コンポーネントは名前付きエクスポート
- 1ファイルに複数の画面・コンポーネントをベタ書きしない
- 表示専用（presentational）と状態保持（container）を意識して分ける

## Hooks / 状態
- ローカル状態は `useState`、派生値は `useMemo`、コールバックは `useCallback`
- 状態と副作用が絡むロジックは **カスタムフック（`useXxx`）に抽出**して `hooks/` に置く
- 不要な `useEffect` を増やさない。propsやstateから計算できる値は `useMemo` で導出する
- 外部の状態管理ライブラリ（Zustand 等）は未導入。導入は方針判断が必要（現状は React 標準のみ）

## useEffect のクリーンアップ必須
タイマー・購読・イベントリスナは **必ずクリーンアップ関数を返す**。返し忘れはリーク・多重発火の原因。
レストタイマーは本アプリの中核機能なので特に注意する。

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
- `StyleSheet.create` を使い、定義は `styles/appStyles.ts` または各コンポーネント末尾に集約する
- **インライン style（`style={{ ... }}`）でのレイアウト定義は禁止**（再生成でパフォーマンス劣化）
  動的値のみインラインを許容（例: `style={[styles.bar, { width: progress }]}`）
- 色・スペーシング・フォントサイズは `styles/theme.ts` の定数を参照（マジック値禁止）
- 視覚表現の判断は `.agents/DESIGN.md` に従う
- NativeWind 等のスタイルライブラリは未導入。導入は方針判断が必要

## リスト・描画パフォーマンス
- リストの `key` は安定した一意ID（配列 index を key にしない）
- 長いリストは `FlatList` を使い、`map` で全件描画しない
- 重い子コンポーネントは `React.memo` を検討する

## Platform 差異
- iOS/Android 差は `Platform.select({ ios, android, default })` で吸収する
- ネイティブ機能（expo-audio・通知・触覚）はエラーになり得るため try-catch + ログ

## ナビゲーション（現状）
- React Navigation / Expo Router は未導入。タブ切替は **現行の state 方式**（`tab` state）を踏襲する
- ルーティングライブラリ導入は別途方針判断する

## ネットワーク
- 通信は `db/sync.ts` に閉じる。screens / components から直接 `fetch` しない
- 同期の失敗はユーザーに見える形で伝える。無言でリトライだけして黙らない
- 詳細は [auth.md](auth.md) と [secrets.md](secrets.md)
