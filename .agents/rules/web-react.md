---
paths: "apps/web/src/**/*.tsx,apps/web/src/**/*.ts"
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
- 取得は `api.ts` の `apiGet` と `hooks/useApiData` を通す。`sections/` から直接 `fetch` しない
- API は別オリジン。接続先は `import.meta.env.VITE_API_ORIGIN` から取り、URL を直書きしない
- レスポンス型は `types/api.ts` に定義し、`apps/api` の返す JSON と対応させる。
  API 側のレスポンス形状を変えたらこのファイルも同じ変更セットで直す
- 読み込み中・エラー・空データの3状態を必ず扱う。`components/Loadable.tsx` を使う

## コンポーネント設計
- `sections/` は1区画1ファイル。区画をまたぐ状態を持たせない
- 表示責務を中心にし、状態と副作用は `hooks/` に置く
- state は必要最小限にし、既存値から導出できる値を重複保存しない
- `dangerouslySetInnerHTML` を使わない

## レイアウト
- PC・タブレット・スマートフォンすべてでページ全体の横スクロールを発生させない
- Grid/Flex の可変領域には `min-width: 0` を設定する
- 画面幅だけで重要な操作や情報を失わせない
- 視覚表現の判断は `.agents/DESIGN.md` に従う。色・余白は `styles.css` の CSS カスタムプロパティを使う

## グラフ
- 外部チャートライブラリは未導入。`components/{LineChart,BarChart,CalendarHeatmap}.tsx` の自作 SVG を使う
- ライブラリ導入は方針判断が必要。勝手に追加しない
- SVG の座標計算はコンポーネント内の純粋関数に切り出す。JSX 内へ計算式を埋め込まない
