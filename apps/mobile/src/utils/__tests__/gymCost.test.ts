import { buildWorkout } from '../../test-support/factories';
import { countVisitDays, summarizeGymCost, yearMonthOfDate } from '../gymCost';

describe('yearMonthOfDate', () => {
  it('ISO 日付から年月を切り出す', () => {
    expect(yearMonthOfDate('2026-08-27')).toBe('2026-08');
  });
});

describe('countVisitDays', () => {
  it('同じ日に複数の記録があっても1回として数える', () => {
    const count = countVisitDays(
      [
        buildWorkout({ id: 'a', performedAt: '2026-08-27' }),
        buildWorkout({ id: 'b', performedAt: '2026-08-27' }),
        buildWorkout({ id: 'c', performedAt: '2026-08-25' }),
      ],
      '2026-08',
    );
    expect(count).toBe(2);
  });

  it('予定は実績として数えない', () => {
    const count = countVisitDays(
      [buildWorkout({ id: 'p', performedAt: '2026-08-28', status: 'planned' })],
      '2026-08',
    );
    expect(count).toBe(0);
  });

  it('記録中（active）は数える', () => {
    const count = countVisitDays(
      [buildWorkout({ id: 'a', performedAt: '2026-08-27', status: 'active' })],
      '2026-08',
    );
    expect(count).toBe(1);
  });

  it('別の月は数えない', () => {
    const count = countVisitDays([buildWorkout({ performedAt: '2026-07-31' })], '2026-08');
    expect(count).toBe(0);
  });
});

describe('summarizeGymCost', () => {
  it('1回あたりと「あと1回行ったとき」を出す', () => {
    expect(summarizeGymCost(8000, 4)).toEqual({
      visitCount: 4,
      yenPerVisit: 2000,
      yenPerVisitAfterNextVisit: 1600,
    });
  });

  it('0回のときは1回あたりを出さない（0除算を持ち込ませない）', () => {
    expect(summarizeGymCost(8000, 0)).toEqual({
      visitCount: 0,
      yenPerVisit: null,
      yenPerVisitAfterNextVisit: 8000,
    });
  });

  it('端数は四捨五入する', () => {
    expect(summarizeGymCost(8000, 3).yenPerVisit).toBe(2667);
  });
});
