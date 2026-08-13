/**
 * オブジェクト（配列を除く）かどうか。**外部入力を検証する境界で使う。**
 *
 * かつて validate.ts と jwt.ts に別実装があり、jwt 側は配列を Record として通していた。
 * 同じ名前で違う判定を持つと、使い回したときに配列がすり抜ける。
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
