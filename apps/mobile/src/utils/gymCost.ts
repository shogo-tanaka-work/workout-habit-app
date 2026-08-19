import type { Workout } from '../types/domain';

// 「今月のジム代は1回あたりいくらか」の集計。
//
// 月額は固定費なので、**行った回数が増えるほど1回あたりは下がる**。その下がり方を
// 見せることで、もう1回行く動機と、契約の見直し（ビジター利用や乗り換え）の判断材料にする。
//
// 回数は**記録がある日数**で数える。1日に2回記録を作っても来訪は1回であり、
// 記録の作り方で単価が変わってしまうと数字を信用できなくなる。

/** ISO 日付（YYYY-MM-DD）が属する年月（YYYY-MM）。 */
export const yearMonthOfDate = (isoDate: string): string => isoDate.slice(0, 7);

/**
 * その月に記録がある日数。予定（planned）は実績ではないので数えない。
 */
export const countVisitDays = (workouts: readonly Workout[], yearMonth: string): number => {
  const days = new Set<string>();
  for (const workout of workouts) {
    if (workout.status === 'planned') {
      continue;
    }
    if (yearMonthOfDate(workout.performedAt) === yearMonth) {
      days.add(workout.performedAt);
    }
  }
  return days.size;
};

export type GymCost = {
  /** その月に行った日数。 */
  visitCount: number;
  /** 1回あたりの金額（円）。**まだ0回なら null**（0除算を呼び出し側へ持ち込ませない）。 */
  yenPerVisit: number | null;
  /** あと1回行ったときの1回あたり（円）。0回のときは「1回行ったら」の金額になる。 */
  yenPerVisitAfterNextVisit: number;
};

/**
 * 月額と来訪日数から1回あたりの金額を出す。
 *
 * 端数は四捨五入。円未満を出しても行動は変わらないため、表示側で丸めずここで決める。
 */
export const summarizeGymCost = (monthlyFeeYen: number, visitCount: number): GymCost => ({
  visitCount,
  yenPerVisit: visitCount > 0 ? Math.round(monthlyFeeYen / visitCount) : null,
  yenPerVisitAfterNextVisit: Math.round(monthlyFeeYen / (visitCount + 1)),
});
