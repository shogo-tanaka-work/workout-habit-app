import { calculatePlates } from '../plates';

describe('calculatePlates', () => {
  it('片側に付けるプレートを重い順に返す', () => {
    expect(calculatePlates(100, 20)).toEqual({
      perSide: [{ weightKg: 25, count: 1 }, { weightKg: 15, count: 1 }],
      remainderKg: 0,
    });
  });

  it('標準プレートで組めない端数を残す', () => {
    const result = calculatePlates(101, 20);
    expect(result.remainderKg).toBeCloseTo(0.5, 3);
  });

  it('バー重量以下なら何も付けない', () => {
    expect(calculatePlates(20, 20)).toEqual({ perSide: [], remainderKg: 0 });
    expect(calculatePlates(10, 20)).toEqual({ perSide: [], remainderKg: 0 });
  });

  it('小数の積み上げで誤差を持ち越さない', () => {
    const result = calculatePlates(23.75, 20);
    expect(result.perSide).toEqual([{ weightKg: 1.25, count: 1 }]);
    expect(result.remainderKg).toBe(0.625);
  });
});
