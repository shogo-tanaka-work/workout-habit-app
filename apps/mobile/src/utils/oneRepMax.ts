import { EPLEY_DIVISOR } from './number';

// 推定1RM の除数を種目ごとに決める。1RM = weight * (1 + reps / 除数)。
//
// BIG3 は FWJ（Fitness World Japan）の RM換算表に合わせる。
// https://fwj.jp/magazine/rm/
//   ベンチプレス          … 最大挙上重量 = 重量 × 回数 ÷ 40 + 重量
//   スクワット・デッドリフト … 最大挙上重量 = 重量 × 回数 ÷ 33.3 + 重量
// それ以外は一般的な Epley 式（÷30）。
//
// **apps/api/src/analytics.ts の SQL も同じ除数を使う。片方だけ変えない。**

/** FWJ 換算表のベンチプレス。 */
export const BENCH_PRESS_DIVISOR = 40;

/** FWJ 換算表のスクワット・デッドリフト。 */
export const SQUAT_DEADLIFT_DIVISOR = 33.3;

// 対象はプリセットの BIG3 だけ。カスタム種目は名前が似ていても Epley を使う
// （「ベンチプレス(足上げ)」のような派生種目まで巻き込むと、根拠のない換算になる）。
const DIVISOR_BY_EXERCISE_ID = new Map<string, number>([
  ['bench-press', BENCH_PRESS_DIVISOR],
  ['squat', SQUAT_DEADLIFT_DIVISOR],
  ['deadlift', SQUAT_DEADLIFT_DIVISOR],
]);

export const rmDivisorFor = (exerciseId: string | undefined): number =>
  (exerciseId === undefined ? undefined : DIVISOR_BY_EXERCISE_ID.get(exerciseId)) ?? EPLEY_DIVISOR;

/**
 * この種目で推定1RM を画面に出すか。
 *
 * **BIG3 だけ出す。** 換算表の裏付けがあるのは BIG3 で、それ以外は Epley 式の
 * 一般論にすぎない。マシン種目やアイソレーションの「推定1RM」は行動を変えない数字で、
 * 記録中の一等地を占めるだけになっていた。
 *
 * 計算そのもの（utils/aggregate.ts）と API のレスポンスは変えない。
 * Claude Code は分析の材料として全種目の値を読む。出さないのは人が見る画面だけ。
 */
export const showsOneRepMax = (exerciseId: string | undefined): boolean =>
  exerciseId !== undefined && DIVISOR_BY_EXERCISE_ID.has(exerciseId);

// 画面に出す換算式の説明。種目によって式が変わるので、根拠を必ず添える。
export const rmFormulaNote = (exerciseId: string | undefined): string => {
  const divisor = rmDivisorFor(exerciseId);
  if (divisor === EPLEY_DIVISOR) {
    return `Epley式（1RM = 重量 × (1 + 回数 ÷ ${EPLEY_DIVISOR})）による推定値です。`;
  }
  return `FWJ の RM換算表（1RM = 重量 × 回数 ÷ ${divisor} + 重量）による推定値です。`;
};
