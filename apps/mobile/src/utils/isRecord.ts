/**
 * オブジェクト（配列を除く）かどうか。**JSON.parse の結果など、外部から来た値を
 * 使う前の入口で挟む。**
 *
 * 同じ判定が outbox / plans / appSettings に別々に書かれていたため、配列を通すか
 * どうかがファイルごとに違う状態だった。
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
