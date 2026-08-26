import {
  EPLEY_DIVISOR,
  estimateOneRepMax,
  formatCount,
  formatVolume,
  formatWeight,
  parseNumber,
  weightForReps,
} from '../number';
import { formatTimer } from '../format';

describe('parseNumber', () => {
  it('数値として読める文字列を数にする', () => {
    expect(parseNumber('72.5', 0)).toBe(72.5);
  });

  it('読めない値はフォールバックへ落とす', () => {
    expect(parseNumber('abc', 20)).toBe(20);
  });

  it('空文字は 0 になる（Number("") が 0 のため、フォールバックへは落ちない）', () => {
    // 入力欄を空にした瞬間に 0 が入る挙動を、意図として固定しておく。
    expect(parseNumber('', 20)).toBe(0);
  });
});

describe('formatCount / formatVolume / formatWeight', () => {
  it('桁区切りを付ける', () => {
    expect(formatCount(12340)).toBe('12,340');
    expect(formatVolume(12340)).toBe('12,340kg');
  });

  it('重量は小数1桁までで末尾ゼロを省く', () => {
    expect(formatWeight(80)).toBe('80kg');
    expect(formatWeight(72.5)).toBe('72.5kg');
    expect(formatWeight(72.44)).toBe('72.4kg');
  });
});

describe('formatTimer', () => {
  it('分:秒（秒は2桁）で出す', () => {
    expect(formatTimer(120)).toBe('2:00');
    expect(formatTimer(95)).toBe('1:35');
    expect(formatTimer(0)).toBe('0:00');
  });
});

describe('estimateOneRepMax', () => {
  it('Epley 式で小数1桁へ丸める', () => {
    expect(estimateOneRepMax(100, 5)).toBe(116.7);
    expect(EPLEY_DIVISOR).toBe(30);
  });

  it('重量・レップが 0 以下なら 0', () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
  });
});

describe('weightForReps', () => {
  it('1RM から目安重量を 0.5kg 刻みで逆算する', () => {
    expect(weightForReps(120, 5)).toBe(103);
    expect(weightForReps(100, 10)).toBe(75);
  });

  it('1RM・レップが 0 以下なら 0', () => {
    expect(weightForReps(0, 5)).toBe(0);
    expect(weightForReps(120, 0)).toBe(0);
  });
});
