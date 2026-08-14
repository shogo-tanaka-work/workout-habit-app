// 送信役。outbox に積まれた操作をサーバへ送り、確定したものをキューから外す。
//
// 書き込み経路は常に1本（ローカル即時反映＋キュー積み）で、切り替わるのは送信タイミングだけ。
// オフラインなら送信が失敗するだけで、記録も画面も止まらない。

import type * as SQLite from 'expo-sqlite';

import type { OutboxEntry } from '../db/outbox';
import {
  countPendingOperations,
  listPendingOperations,
  recordFailure,
  removeOperations,
} from '../db/outbox';

/** 何度送っても拒否される操作を諦める回数。壊れた操作でキューが詰まるのを防ぐ。 */
const MAX_ATTEMPTS = 5;

// 認証は Google ID トークン。期限が1時間と短いため、送信のたびに調達する
// （src/auth/googleAuth.ts の getIdToken が必要なら silent sign-in で取り直す）。
type SyncConnection = { apiUrl: string; getIdToken: () => Promise<string> };

type PushResult = {
  /** 送信した操作数。 */
  sent: number;
  /** サーバが受け付けた操作数（適用済み・重複・後勝ちで負けたものを含む）。 */
  settled: number;
  /** 拒否されてキューに残った操作数。 */
  failed: number;
  /** 送信後に残っている未送信件数。 */
  pending: number;
};

type ServerOperationResult = {
  id: string;
  status: 'applied' | 'duplicate' | 'stale' | 'rejected';
  error?: string;
};

type ServerResponse = { appliedAt: string; results: ServerOperationResult[] };

const normalizeBaseUrl = (apiUrl: string): string => apiUrl.trim().replace(/\/+$/, '');

const toRequestOperation = (entry: OutboxEntry): Record<string, unknown> => ({
  id: entry.id,
  at: entry.occurredAt,
  op: entry.op,
  entity: entry.entity,
  ...(entry.op === 'upsert' ? { row: entry.row } : { rowId: entry.rowId }),
});

const isServerResponse = (value: unknown): value is ServerResponse =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as { results?: unknown }).results);

/**
 * 未送信の操作をまとめて送る。
 * 部分成功を前提とし、受け付けられた操作だけをキューから外す。
 */
export const pushPendingOperations = async (
  database: SQLite.SQLiteDatabase,
  connection: SyncConnection,
): Promise<PushResult> => {
  const entries = await listPendingOperations(database);
  if (entries.length === 0) {
    return { sent: 0, settled: 0, failed: 0, pending: 0 };
  }

  // upsert なのに行スナップショットが無いものは送りようがない。捨ててキューを詰まらせない。
  const broken = entries.filter((entry) => entry.op === 'upsert' && entry.row === null);
  if (broken.length > 0) {
    console.warn(`[sync] 行スナップショットを失った操作を破棄します: ${broken.length}件`);
    await removeOperations(
      database,
      broken.map((entry) => entry.id),
    );
  }
  const sendable = entries.filter((entry) => entry.op === 'delete' || entry.row !== null);
  if (sendable.length === 0) {
    return { sent: 0, settled: 0, failed: 0, pending: await countPendingOperations(database) };
  }

  const idToken = await connection.getIdToken();
  const response = await fetch(`${normalizeBaseUrl(connection.apiUrl)}/sync/operations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ operations: sendable.map(toRequestOperation) }),
  });
  if (!response.ok) {
    throw new Error(`同期APIがエラーを返しました (HTTP ${response.status})`);
  }

  const body: unknown = await response.json();
  if (!isServerResponse(body)) {
    throw new Error('同期APIの応答形式が不正です');
  }

  const attemptsById = new Map(sendable.map((entry) => [entry.id, entry.attempts]));
  const settledIds: string[] = [];
  const givenUpIds: string[] = [];
  const retryIds: string[] = [];
  let representativeError: string | null = null;
  let failed = 0;

  for (const result of body.results) {
    // applied / duplicate / stale はいずれも「サーバ側の状態が確定した」ので取り下げる。
    if (result.status !== 'rejected') {
      settledIds.push(result.id);
      continue;
    }
    failed += 1;
    representativeError ??= result.error ?? null;
    const attempts = (attemptsById.get(result.id) ?? 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      console.warn(`[sync] ${MAX_ATTEMPTS}回拒否された操作を破棄します: ${result.error ?? ''}`);
      givenUpIds.push(result.id);
      continue;
    }
    retryIds.push(result.id);
  }

  if (retryIds.length > 0) {
    // last_error は全件共通の文言になるが、件数と代表エラーが分かれば調査の起点には足りる。
    await recordFailure(
      database,
      retryIds,
      `${failed}件拒否（例: ${representativeError ?? 'rejected'}）`,
    );
  }
  await removeOperations(database, [...settledIds, ...givenUpIds]);

  return {
    sent: sendable.length,
    settled: settledIds.length,
    failed,
    pending: await countPendingOperations(database),
  };
};
