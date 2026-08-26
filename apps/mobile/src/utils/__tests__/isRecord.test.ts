import { isRecord } from '../isRecord';

// JSON.parse の結果など、外部から来た値の入口で使う判定。
// 配列を通すかどうかがファイルごとに違っていたのをここへ集約している。
describe('isRecord', () => {
  it('オブジェクトを通す', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ id: 'w1' })).toBe(true);
  });

  it('配列は通さない', () => {
    expect(isRecord([])).toBe(false);
    expect(isRecord([{ id: 'w1' }])).toBe(false);
  });

  it('null と プリミティブは通さない', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord('{}')).toBe(false);
    expect(isRecord(0)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});
