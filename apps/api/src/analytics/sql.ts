// 集計 SQL に埋める条件と式。**新しい集計クエリはここの定数を使って組み立てる。**
//
// 手書きでコピーしていると、書き忘れても型でも lint でも捕まらない。
// ウォームアップ除外を1つのクエリで落とすと、そのエンドポイントだけ
// 「軽い準備セットを足すほど総ボリュームが増える」状態になる。

/**
 * 集計に数えるセットの条件。**新しい集計クエリを書くときは必ず添える。**
 *
 * 手書きでコピーしていると、書き忘れても型でも lint でも捕まらず、
 * 「ウォームアップを足すほど総ボリュームが増える」というこの規則が防ぎたい事故が
 * そのまま再発する。列別名は呼び出し側のリテラルであること。
 */
export const countedSetsCondition = (setsAlias: string): string =>
  `${setsAlias}.deleted_at IS NULL AND ${setsAlias}.is_warmup = 0`;

/** 集計対象のワークアウト。予定や記録中は数えない。 */
export const COMPLETED_WORKOUT_STATUS = 'completed';

export const EPLEY_DIVISOR = 30;

// 推定1RM は「weight * (1 + reps / 除数)」で、除数だけが種目で変わる。
// BIG3 は FWJ の RM換算表（ベンチ ÷40、スクワット・デッドリフト ÷33.3）、それ以外は Epley 式。
// **モバイル側 src/utils/oneRepMax.ts と同じ値を保つ。片方だけ変えない。**
export const rmDivisorSql = (exerciseIdColumn: string): string =>
  `CASE ${exerciseIdColumn}
     WHEN 'bench-press' THEN 40.0
     WHEN 'squat' THEN 33.3
     WHEN 'deadlift' THEN 33.3
     ELSE ${EPLEY_DIVISOR}.0
   END`;
