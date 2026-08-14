---
paths: "apps/web/src/**/*.tsx,apps/web/src/**/*.ts,apps/web/worker/**/*.ts"
---
# 管理画面（React + Vite）

対象: Vite 7 / React 19 / TypeScript strict。**読み取り専用**のダッシュボード。

## 責務の境界
- 書き込み系の機能を持たない。`POST` / `PUT` / `DELETE` を呼ばない
- **集計をクライアントで実装しない**。集計は `apps/api` の `/analytics/*` に一元化する
- クライアントで許されるのは表示整形だけ（空週の穴埋め、桁揃え、ラベル文言、並び替え）
- 整形ロジックは `utils/datetime.ts` / `utils/number.ts` の純粋関数に置く

新しい集計値が必要になったら、`sections/` で計算せず API 側にエンドポイントか項目を追加する。

## データ取得
- 取得は `api.ts` の `apiGet` と `hooks/useApiData` を通す。`sections/` から直接 `fetch` しない。
  取得先は `/analytics/*` のほか `/plans`（予定）と `/me`（表示中のユーザー）がある
- API は**同一オリジンの `/api/*`**。配信元 Worker（`worker/index.ts`）が
  Service Binding で `workout-habit-api` へ中継する。オリジンを直書きしない
- **画面は認証情報を持たない。** 認証は Cloudflare Access がホストの入口で済ませている。
  トークンの入力・保存・送信を復活させない
- レスポンス型は `types/api.ts` に定義し、`apps/api` の返す JSON と対応させる。
  API 側のレスポンス形状を変えたらこのファイルも同じ変更セットで直す
- 読み込み中・エラー・空データの3状態を必ず扱う。`components/Loadable.tsx` を使う。
  例外は画面の主役でない補助表示（`components/Viewer.tsx` の「誰として見ているか」）。
  取得に失敗しても表示を消すだけにし、ダッシュボード本体をエラー画面に変えない
- 表示設定（週次目標など、サーバに持たせるほどでない値）は `localStorage` に置いてよい。
  記録データを `localStorage` へ写さない
- **`npm run dev` では `/api/*` が 404 になる。** 中継役の Worker が居ないため。
  データを伴う確認はデプロイ後の環境で行う

## 配信元 Worker（worker/index.ts）

- 役割は「dist の配信」と「`/api/*` の中継」だけ。**集計・認可・データ加工を持ち込まない**
- 中継時にヘッダを加工しない。Access の JWT はそのまま渡し、検証は API Worker が行う。
  これは Access の JWT を落とさないための規則であり、**アセット配信レスポンスへの
  セキュリティヘッダ付与（CSP 等）は中継ではないため該当しない**
- ここに新しいエンドポイントを生やさない。API が必要なら `apps/api` へ追加する

## コンポーネント設計
- `sections/` は1区画1ファイル。区画をまたぐ状態を持たせない
- 表示責務を中心にし、状態と副作用は `hooks/` に置く
- state は必要最小限にし、既存値から導出できる値を重複保存しない
- `dangerouslySetInnerHTML` を使わない

## レイアウト
- PC・タブレット・スマートフォンすべてでページ全体の横スクロールを発生させない
- 画面幅だけで重要な操作や情報を失わせない
- 視覚表現の判断は `.agents/DESIGN.md` に従う。色・余白は `styles.css` の CSS カスタムプロパティを使う

## グラフ
- 外部チャートライブラリは未導入。`components/{LineChart,BarChart,CalendarHeatmap}.tsx` の自作 SVG を使う
- ライブラリ導入は方針判断が必要。勝手に追加しない
- SVG の座標計算はコンポーネント内の純粋関数に切り出す。JSX 内へ計算式を埋め込まない
