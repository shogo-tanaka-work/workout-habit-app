import { newId } from '../id';

describe('newId', () => {
  it('接頭辞を先頭に付ける', () => {
    expect(newId('workout')).toMatch(/^workout-/);
  });

  it('連続で呼んでも衝突しない', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId('set')));
    expect(ids.size).toBe(200);
  });
});
