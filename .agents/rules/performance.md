---
paths: "**/*.ts,**/*.tsx"
---
# パフォーマンス

3アプリ横断の観点。アプリ固有の実装規則は各 rules（`d1.md` / `mobile-sqlite.md` /
`mobile-react-native.md` / `web-react.md`）にあり、ここでは再掲しない。

## 判断の原則

1. **構造の問題は書く前に避ける。** ループ内 I/O・全件読み・直列ウォーターフォールは
   「計測してから直す」対象ではない。データが増えた分だけ確実に遅くなる形だから
2. **それ以外は計測してから直す。** 推測で最適化しない。
   `React.memo` / `useMemo` / `useCallback` の追加は、計測結果か明確な構造根拠
   （「全 state の参照が変わって全画面が再描画される」のような）がある場合に限る。
   根拠なく撒くと、依存配列の比較コストと読みにくさだけが残る
3. **「増えたらどうなるか」で設計する。** 増え続けるデータ（記録・セット）と
   有限のマスタ（部位・種目）を区別し、前者には上限・絞り込み・ページングを考える

## ループの中で I/O を発行しない

DB クエリ・外部 fetch をループ内で1件ずつ発行しない。件数分のラウンドトリップが積み上がる
（N+1 問題）。

```ts
// NG（種目の数だけクエリが飛ぶ）
for (const exercise of exercises) {
  const sets = await db.getAllAsync('SELECT ... WHERE exercise_id = ?', [exercise.id]);
}

// OK（1クエリにまとめる）
const sets = await db.getAllAsync('SELECT ... WHERE exercise_id IN (...)', ids);
```

- まとめ方は3つ: **JOIN / `IN (...)` / バッチ**（D1 は `DB.batch()`、実装規則は `d1.md`）
- 外部 fetch も同じ。互いに依存しなければ `Promise.all` で並列にする
- 例外は**順序に意味がある逐次処理**（outbox の送信順など）。逐次であるべき理由を
  コメントで書く

## 直列のウォーターフォールを作らない（並列にできるものだけ）

**対象は「互いに依存しない I/O が直列に並んでいる」場合だけ。**
前の結果を次が使う逐次フロー（入力の検証 → 登録 → 台帳へ記録、のような書き込み処理）は
直列が正しい形であり、この規則の対象ではない。

```ts
// 対象（互いに依存しない読み取り。合計時間が「和」になる）
const workouts = await loadWorkouts();
const exercises = await loadExercises();

// 並列にすると最も遅い1つ分で済む（端末 SQLite の loadWorkoutTables が実例）
const [workouts, exercises] = await Promise.all([loadWorkouts(), loadExercises()]);

// 対象外（前の結果に依存する逐次処理。直列のまま書く）
const operation = parseOperation(body);
await applyOperation(database, operation);
await recordToLedger(database, operation.id);
```

- 並列化が効くのは**独立した I/O**（外部 fetch、端末 SQLite の読み取りなど）
- **D1 のクエリ同士を `Promise.all` にしても効果は薄い。** D1 は1データベースあたり
  実質逐次処理で、並列に投げても DB 側で並ぶ。D1 で削るべきは**往復回数**であり、
  それは `batch()` の役割（`d1.md`）

## 過剰取得をしない

- レスポンス・戻り値は使う分だけ組み立てる。内部の行をそのまま返さない
  （`SELECT *` の禁止は `d1.md` / `mobile-sqlite.md`、入力上限の定数は `api.md`）
- **往復回数もペイロードの一部。** 同じ画面の初期表示のために API を何度も往復させない
  （まとめられるなら画面単位のレスポンスを検討する）。逆に何でも1レスポンスへ詰めず、
  初期表示に要るものと、操作されてから取ればよいものを分ける
- 書き込み後の再読込は変更したものだけ読み直す（mobile の `reloadTables` が実例）
- 端末 SQLite の全件読みは「キャッシュを画面へ配る」設計として現規模では許容する。
  遅くなったら件数を測ってから絞り込みを設計する（先回りで複雑にしない）

## 計測手段の正本

| アプリ | 手段 |
|---|---|
| mobile | **React Native DevTools**（Metro で `j` キー）。再レンダリングは React Profiler。書き込み後の再読込は `__DEV__` の `[perf] reload` ログ。**Flipper は RN 0.74 以降非推奨。導入しない** |
| web | Lighthouse と Chrome DevTools の Performance パネル |
| api | `wrangler tail`（揮発性）と Workers ダッシュボードの Observability。クエリの読み取り行数は D1 の `meta.rows_read` |

計測値を根拠に直したら、その数値を変更セット（コミット本文か roadmap）に残す。
次に同じ場所を触る人が「なぜこの形か」を辿れるようにする。

## 今は導入しない（導入条件つき）

先回りの導入は複雑さだけが先に来る。条件を満たしたら方針判断のうえで入れる。

| 対象 | 導入条件 |
|---|---|
| FlashList / react-window（リスト仮想化） | リストが実測でフレーム落ちしたら。目安は `mobile-react-native.md` の50件基準 |
| web-vitals の常時計測 | 管理画面を本人以外へ広く公開したら |
| API レスポンスのキャッシュ層（Cache-Control / edge cache） | 集計 API の応答が実測で遅いと分かったら。入れるときは**失効（何を・TTL・誰が消すか）とセットで設計**する。本人ごとのデータのため共有キャッシュには乗せない前提 |
| `hono/timing`（Server-Timing での区間計測） | API が遅いと分かり、認証・D1・整形のどこかを切り分けたくなったら |
| Smart Placement 等の Workers チューニング | Observability でボトルネックが特定できたら |

## チェックリスト（実装後セルフレビュー）

- [ ] ループ内にクエリ・fetch が無いか（あるなら逐次であるべき理由が書いてあるか）
- [ ] 依存の無い `await` が直列に並んでいないか（依存がある逐次フローは対象外）
- [ ] 同じ画面のための API 往復・レスポンスの肥大化を増やしていないか
- [ ] 新しい・変更したクエリを `EXPLAIN QUERY PLAN` で確認したか（`d1.md`）
- [ ] memo 系の追加に計測か構造根拠があるか
- [ ] 増え続けるデータへの読み書きに上限・絞り込みがあるか
