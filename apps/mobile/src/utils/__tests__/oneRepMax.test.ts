import { EPLEY_DIVISOR } from '../number';
import {
  BENCH_PRESS_DIVISOR,
  rmDivisorFor,
  rmFormulaNote,
  SQUAT_DEADLIFT_DIVISOR,
  showsOneRepMax,
} from '../oneRepMax';

describe('rmDivisorFor', () => {
  it('BIG3 は FWJ 換算表の除数を使う', () => {
    expect(rmDivisorFor('bench-press')).toBe(BENCH_PRESS_DIVISOR);
    expect(rmDivisorFor('squat')).toBe(SQUAT_DEADLIFT_DIVISOR);
    expect(rmDivisorFor('deadlift')).toBe(SQUAT_DEADLIFT_DIVISOR);
  });

  it('それ以外は Epley 式', () => {
    expect(rmDivisorFor('incline-dumbbell-press')).toBe(EPLEY_DIVISOR);
    expect(rmDivisorFor(undefined)).toBe(EPLEY_DIVISOR);
  });

  it('名前が似ているカスタム種目を巻き込まない', () => {
    expect(rmDivisorFor('custom-bench-press-feet-up')).toBe(EPLEY_DIVISOR);
  });
});

describe('showsOneRepMax', () => {
  it('推定1RM を画面に出すのは BIG3 だけ', () => {
    expect(showsOneRepMax('bench-press')).toBe(true);
    expect(showsOneRepMax('lat-pulldown')).toBe(false);
    expect(showsOneRepMax(undefined)).toBe(false);
  });
});

describe('rmFormulaNote', () => {
  it('種目によって根拠の説明を変える', () => {
    expect(rmFormulaNote('bench-press')).toContain('FWJ');
    expect(rmFormulaNote('lat-pulldown')).toContain('Epley');
  });
});
