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
- `StyleSheet.create` を使い、定義は `styles/appStyles.ts` へ集約する。
  コンポーネント末尾に個別の `StyleSheet.create` を作らない（現状も appStyles.ts の1本だけ）
- **インライン style（`style={{ ... }}`）でのレイアウト定義は禁止**（再生成でパフォーマンス劣化）
  動的値のみインラインを許容（例: `style={[styles.bar, { width: progress }]}`）
- 色・スペーシング・フォントサイズは `styles/theme.ts` の定数を参照（マジック値禁止）
- 視覚表現の判断は `.agents/DESIGN.md` に従う
- NativeWind 等のスタイルライブラリは未導入。導入は方針判断が必要

## リスト・描画パフォーマンス
- リストの `key` は安定した一意ID（配列 index を key にしない）。
  値から一意キーを作れない並び（共通タイマーのプリセットなど、同じ値が複数あり得て
  途中削除も起きるもの）に限り `${index}-${値}` の併用を許す
- **50件を超え得るリストは `FlatList` を使う。** それ以下は `ScrollView` + `map` でよい。
  現状の最大は種目一覧の35件で、全リストが `ScrollView` + `map`。
  履歴が伸びて種目数や実施日数が50件を超えるようになったら切り替える
- 重い子コンポーネントは `React.memo` を検討する。ただし導入は計測か構造根拠がある場合だけ
  （[performance.md](performance.md) の判断原則）
- 計測は **React Native DevTools**（Metro で `j` キー。React Profiler を含む）を使う。
  **Flipper は RN 0.74 以降非推奨。導入しない**

## Platform 差異
- iOS/Android 差は `Platform.OS === 'ios'` の分岐か `Platform.select({ ios, android, default })`
  で吸収する。分岐先が値だけなら前者、まとまった設定を切り替えるなら後者
- ネイティブ機能（expo-audio・通知・振動）はエラーになり得るため try-catch で受ける。
  **失敗しても記録の入力を止めない**（音が鳴らなくてもセットは保存できる）

## ナビゲーション（現状）

React Navigation / Expo Router は未導入。`App.tsx` が3層の state で出し分ける。
ルーティングライブラリの導入は別途方針判断する。

| 層 | state | 何を決めるか |
|---|---|---|
| タブ | `tab` | ホーム / 記録 / 履歴 / 設定 |
| 設定のサブ画面 | `settingsRoute` | 設定タブの中でどの画面を開いているか |
| オーバーレイ | `overlay`（派生値） | タブの上へ全面でかぶせる画面（種目詳細・記録の編集・設定サブ画面） |

- **オーバーレイの判定は `App.tsx` の `overlay` 1か所に集約する。**
  ヘッダーの戻る導線、タブバーの出し分け、FAB の表示はすべてこの値を見る。
  条件を各所に散らすと、ある画面でだけタブが残るといった食い違いが起きる
- タブを移ったら `settingsRoute` は入口へ戻す

## ネットワーク

`fetch` を書いてよいのは次の3ファイルだけ。screens / components から直接呼ばない。

| ファイル | 向き | 相手 |
|---|---|---|
| `sync/pusher.ts` | 送信 | `POST /sync/operations` |
| `db/sync.ts` | 取り込み | `GET /backup`（端末を作り直す復元） |
| `db/plans.ts` | 取り込み | `GET /plans`（Claude Code が書いた予定） |

- 同期の失敗はユーザーに見える形で伝える。無言でリトライだけして黙らない
- 詳細は [auth.md](auth.md) と [secrets.md](secrets.md)

## セットの入力は入口が違っても同じ部品を使う

同じ「セットを入れる」であり、入口で別の UI にしない。
かつて編集側だけ別部品（`SetEditor` の縦積み）にしていたため、記録タブを刷新したあとも
編集画面だけ古い UI のまま取り残された。

| 場面 | 入口 | 使う部品 |
|---|---|---|
| 記録中の入力 | 記録タブ → 種目を選ぶ | `ExercisePicker` → `ExerciseLogPanel` → `ExerciseLogSection` |
| 記録の編集 | ホームの日詳細 →「編集」 | `WorkoutEditScreen` → `WorkoutExerciseList` → `ExerciseLogSection` |

- `ExerciseLogPanel` は**1種目だけ**を見せる。今日の全種目を1画面に積み上げない
  （一日の全体像はホームのカレンダー、期間の集計は履歴タブが受け持つ）
- 場面ごとの違いは `ExerciseLogSection` の props で出し分ける。部品を分けない
- 休憩タイマーは**記録中だけ**出す（過去日の記録にこれから休む場面は無い）
- 記録中の削除は確認を挟まない（打ち間違いの消し直しが多い）。
  過去記録の削除は確認を挟む（`confirmSetDelete`）。1日ぶんの記録の削除も確認を挟む
- **種目の削除は必ず確認を挟む**（セットごと消えるため。セットが1つも無くても同じ）

### メモは種目に1つ

`workout_exercises.memo` に書く。セット単位（`workout_sets.memo`）には**入力口を置かない**。
書きたいのは「この種目の調子・フォームの気づき」で、セットごとに分ける粒度ではなかった。

`workout_sets.memo` の列と過去のデータは残す（CSV の `memo` 列にも残る）。閉じたのは入力口だけ。

### ウォームアップはセット表で切り替える

`SetLogTable` の「WU」行で直接トグルする。操作シートの中にあったころは存在に気づけなかった。
集計から外れる＝実績の見え方が変わる操作は、表に出しておく。

## 推定1RM は種目で式が変わる

`utils/oneRepMax.ts` が除数を決める。BIG3 は FWJ の RM換算表（https://fwj.jp/magazine/rm/）、
それ以外は Epley 式。

- ベンチプレス … 重量 × 回数 ÷ **40** + 重量
- スクワット・デッドリフト … 重量 × 回数 ÷ **33.3** + 重量
- それ以外 … 重量 × 回数 ÷ **30** + 重量（Epley）

対象はプリセットの BIG3（`bench-press` / `squat` / `deadlift`）だけ。派生種目や
カスタム種目は Epley のままにする（根拠のない換算を広げない）。

**`estimateOneRepMax` / `summarizeSets` を呼ぶときは `rmDivisorFor(exerciseId)` を渡す。**
渡し忘れても既定値（Epley）で動いてしまい、BIG3 の数字だけが静かにずれる。
種目が特定できない集計（日や期間をまたぐもの）では既定のままでよい。

**`apps/api/src/analytics/sql.ts` の `rmDivisorSql` も同じ除数を使う。片方だけ変えない。**

### 画面に出すのは BIG3 だけ

`showsOneRepMax(exerciseId)` が判定する。BIG3 以外の推定1RM は Epley 式の一般論で、
見ても次の一手が変わらない。記録中の一等地を使わない。

- 対象は記録・編集・種目詳細・履歴と、管理画面（`apps/web/src/utils/oneRepMax.ts`）
- 種目詳細の RM 計算機も BIG3 だけに出す（推定1RM を出す道具そのもののため）
- **API のレスポンスは絞らない。** Claude Code は計画を立てる材料に全種目の値を読む。
  出さないのは人が見る画面だけ

## 休憩タイマーは2層

- **種目タイマー** … 種目ごとに1件（`exercises.default_rest_seconds` と
  `user_exercise_settings.rest_seconds` の上書き）
- **共通タイマー** … 種目をまたいで使い回すプリセット。`REST_PRESET_LIMIT` = 最大3件。
  端末ローカル（`app_settings` の `timer_rest_presets`）で同期しない

上限と既定値は `types/domain.ts` の `REST_PRESET_LIMIT` / `DEFAULT_REST_PRESETS` を参照する。
壊れた値・空配列は読み込み時に既定へ落とす（`db/queries.ts`）。
