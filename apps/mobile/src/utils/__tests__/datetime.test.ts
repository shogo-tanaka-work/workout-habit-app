import {
  daysBetween,
  formatDate,
  formatDateTime,
  formatJapaneseDate,
  formatMonthDay,
  isoDateMonthsAgo,
  isoDatePlusDays,
  periodStartIso,
  startOfWeekIso,
  startOfWeekIsoDate,
} from '../datetime';

describe('formatDate', () => {
  it('端末ローカルの日付を YYYY-MM-DD で返す', () => {
    expect(formatDate(new Date(2026, 7, 5, 23, 30))).toBe('2026-08-05');
  });

  it('月と日を2桁へ揃える', () => {
    expect(formatDate(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('isoDatePlusDays', () => {
  it('月をまたいで戻れる', () => {
    expect(isoDatePlusDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('年をまたいで進める', () => {
    expect(isoDatePlusDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('うるう年の2月29日を落とさない', () => {
    expect(isoDatePlusDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('daysBetween', () => {
  it('年をまたいだ日数を数える', () => {
    expect(daysBetween('2025-12-30', '2026-01-02')).toBe(3);
  });

  it('同じ日は 0', () => {
    expect(daysBetween('2026-08-27', '2026-08-27')).toBe(0);
  });

  it('未来から過去への差は負になる', () => {
    expect(daysBetween('2026-08-27', '2026-08-25')).toBe(-2);
  });
});

describe('formatJapaneseDate / formatMonthDay', () => {
  it('ISO 日付をローカル日付として読む（UTC 解釈で曜日をずらさない）', () => {
    // 2026-08-27 は木曜。UTC 解釈だと日本時間では前日になり曜日がずれる。
    expect(formatJapaneseDate('2026-08-27')).toBe('8月27日(木)');
  });

  it('グラフ向けの短い表記', () => {
    expect(formatMonthDay('2026-08-05')).toBe('8/5');
  });
});

describe('formatDateTime', () => {
  it('月日と時刻を並べる', () => {
    expect(formatDateTime(new Date(2026, 7, 27, 14, 32).toISOString())).toBe('8/27 14:32');
  });
});

describe('startOfWeekIso', () => {
  it('月曜はじまりで週頭を返す', () => {
    // 2026-08-27（木）の週頭は 2026-08-24（月）。
    expect(startOfWeekIso(new Date(2026, 7, 27))).toBe('2026-08-24');
  });

  it('日曜はその週の月曜へ戻る（翌週にしない）', () => {
    expect(startOfWeekIso(new Date(2026, 7, 30))).toBe('2026-08-24');
  });

  it('月曜はその日を返す', () => {
    expect(startOfWeekIsoDate('2026-08-24')).toBe('2026-08-24');
  });
});

describe('isoDateMonthsAgo', () => {
  it('n か月前の同日を返す', () => {
    expect(isoDateMonthsAgo(3, new Date(2026, 7, 27))).toBe('2026-05-27');
  });
});

describe('periodStartIso', () => {
  it('null は期間の制限なし', () => {
    expect(periodStartIso(null, new Date(2026, 7, 27))).toBeNull();
  });

  it('0 は今週の月曜', () => {
    expect(periodStartIso(0, new Date(2026, 7, 27))).toBe('2026-08-24');
  });

  it('正の月数はその月数ぶん前', () => {
    expect(periodStartIso(1, new Date(2026, 7, 27))).toBe('2026-07-27');
  });
});
