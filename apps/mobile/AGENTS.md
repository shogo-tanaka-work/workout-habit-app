# workout-habit mobile — 開発ガイド

筋トレの習慣化を支援する **オフライン優先** のモバイルアプリ。記録（種目・セット・重量・レップ）と
インターバルタイマーを端末内 SQLite で扱い、ネットワークが無くてもすべての機能が動く。

**正データは D1（サーバ）**で、端末は表示用キャッシュ＋操作キュー（outbox）。
記録はローカルへ即時反映しつつキューへ積み、種目の完了などの契機で送信する。
詳細は `.agents/rules/mobile-sqlite.md`。

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
| ローカルDB | expo-sqlite | 12テーブル。マスタ（部位・種目・上書き）＋記録（workout/sets）＋設定・ボディログ・送信キュー |
| 音声 | expo-audio | タイマー完了音（timer-complete.wav） |
| 通知 | expo-notifications | 休憩終了のローカル通知。アプリ内と同じ音を鳴らす |
| ピッカー | @react-native-picker/picker | レスト時間選択 |
| 認証 | @react-native-google-signin/google-signin | Google サインイン。ID トークンは保存せず都度取得 |
| ナビゲーション | **自前の state 方式**（タブ4画面） | React Navigation / Expo Router は未導入 |
| 状態管理 | React 標準（useState / useMemo） | Zustand 等の外部ライブラリは未導入 |
| スタイル | StyleSheet | NativeWind 等は未導入 |

外部ライブラリの新規導入は方針判断が必要なため、勝手に追加しない。

## 画面構成（4タブ）

| タブ | 役割 |
|---|---|
| Home | カレンダーで「いつ何をやったか」。日を選んでその日の記録・ボディログを見る／入れる |
| Workout | 種目を選ぶ → その1種目だけ記録する。休憩タイマーもここ |
| History | 期間 × 種目の集計。日付ごとの一覧は持たない（Home の役目） |
| Settings | 用途別のメニュー。マスタ管理（種目）／ツール／設定（タイマー・同期）／データ（CSV） |

タブの上へ全面でかぶせる画面（種目詳細・記録の編集・設定のサブ画面）は `App.tsx` の
`overlay` が1か所で扱う。ヘッダーの戻る導線とタブの出し分けはここに集約する。

## ディレクトリ構成

```
apps/mobile/
  src/
    types/        domain.ts（ドメイン型）/ db.ts（SQLite 行型）
    auth/         googleAuth.ts（Google サインインと ID トークンの調達）
    db/           schema.ts / seed.ts / migrations.ts / mappers.ts
                  loadWorkoutData.ts（読み取り）/ queries.ts（同期対象への書き込み）
                  appSettings.ts（端末ローカルの設定。outbox に積まない）
                  outbox.ts（操作キュー）/ syncTables.ts（同期対象の定義）/ sync.ts（取り込み）
    sync/         pusher.ts（送信役）
    hooks/        useWorkoutData / useRestTimer
    utils/        datetime / format / number / workoutTree / aggregate / oneRepMax
                  plates / calendar / calendarMarks / csv / id
    components/   記録: ExercisePicker / ExerciseLogPanel / SetLogTable / SetActionSheet / RecentSessions
                  編集: WorkoutExerciseList / SetEditor
                  共通: TimerBanner / TrendChart / StatSummary / MonthCalendar / PlateCalculator ほか
    screens/      HomeScreen / WorkoutScreen / HistoryScreen / SettingsScreen
                  ExerciseListScreen / ExerciseDetailScreen / TimerSettingsScreen / WorkoutEditScreen
    styles/       theme.ts（色・余白・フォント）/ appStyles.ts（共有 StyleSheet）
  App.tsx         DB初期化・タブ切替のみの薄いシェル
```

DB行型（snake_case）とドメイン型（camelCase）は分離し、変換は `db/mappers.ts` の
`toBodyPart` / `toExercise` / `toWorkout` に集約する。

## 環境変数

Google OAuth のクライアント ID はリポジトリへ書かない（`.agents/rules/secrets.md`）。
`apps/mobile/.env.local` に置く（gitignore 済み）。`app.config.js` が `iosUrlScheme` を注入する。

```
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.xxxxxxxx  # iOS クライアントの REVERSED_CLIENT_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com   # idToken の取得に必須
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com   # 任意
```

値を変えたら `npx expo prebuild --clean` からやり直す（ネイティブ設定に焼き込まれる）。

## ⚠️ app.json のプラグイン設定を変えたら prebuild を明示的に実行する

**`npm run ios` は `ios/` が既にあると prebuild を再実行しない。**
`app.json` の `plugins` を変えても、そのままではネイティブへ反映されずビルドは成功する。
「ビルドが通ったのに設定が効かない」という形で出るため気づきにくい。

```bash
npx expo prebuild -p ios   # プラグイン設定を反映
npm run ios                # そのあとビルド
```

例: 通知音（`expo-notifications` の `sounds`）を足したときは、
prebuild を挟まないと wav がアプリバンドルへ入らず、通知が無音になる。
反映されたかは `find ios -name '<ファイル名>'` と、
ビルド後の `.app` の中を見て確かめる。

## 開発コマンド

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint（eslint-config-expo）
npm run format      # prettier --write
npm run ios         # 実機/シミュレータ実行（expo run:ios）
npm run start       # Metro 起動
```
