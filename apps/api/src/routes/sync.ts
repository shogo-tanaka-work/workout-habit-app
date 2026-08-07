// 操作ベースの同期エンドポイント。
//
// 端末は記録操作をローカルへ即時反映しつつキュー（outbox）へ積み、
// 種目の全セット完了などの契機でここへまとめて送る。
// 送るのはスナップショットではなく操作（intent）なので、削除も明示的に表現できる。
//
// 1件が失敗しても残りは適用する（部分成功）。HTTP は body 自体が不正なときだけ 400。

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import type { OperationResult } from '../sync/apply';
import { applyOperations } from '../sync/apply';
import { parseOperations } from '../sync/validate';

export const sync = new Hono<AppEnv>();

sync.post('/operations', async (context) => {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch (error) {
    return context.json(
      { error: `invalid json: ${error instanceof Error ? error.message : String(error)}` },
      400,
    );
  }

  const parsed = parseOperations(body);
  if (!parsed.ok) {
    return context.json({ error: parsed.error }, 400);
  }

  const validOperations = parsed.operations.flatMap((item) => (item.ok ? [item.operation] : []));
  const { appliedAt, results } = await applyOperations(
    context.env.DB,
    context.get('user'),
    validOperations,
  );
  const resultById = new Map(results.map((result) => [result.id, result]));

  // 検証で落ちた操作も含め、送られた順に結果を返す。
  let unnamedCount = 0;
  const merged: OperationResult[] = parsed.operations.map((item) => {
    if (!item.ok) {
      unnamedCount += item.id === null ? 1 : 0;
      return {
        id: item.id ?? `unknown-${unnamedCount}`,
        status: 'rejected' as const,
        error: item.error,
      };
    }
    return (
      resultById.get(item.operation.id) ?? {
        id: item.operation.id,
        status: 'rejected' as const,
        error: 'not processed',
      }
    );
  });

  const appliedCount = merged.filter((result) => result.status === 'applied').length;
  return context.json({ appliedAt, appliedCount, results: merged });
});
