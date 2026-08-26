import { createFakeDatabase } from '../../test-support/fakeDatabase';
import type { OutboxEntry } from '../../db/outbox';
import {
  countPendingOperations,
  listPendingOperations,
  recordFailure,
  removeOperations,
} from '../../db/outbox';
import { pushPendingOperations } from '../pusher';

jest.mock('../../db/outbox', () => ({
  listPendingOperations: jest.fn(),
  countPendingOperations: jest.fn(),
  recordFailure: jest.fn().mockResolvedValue(undefined),
  removeOperations: jest.fn().mockResolvedValue(undefined),
}));

const listPendingOperationsMock = jest.mocked(listPendingOperations);
const countPendingOperationsMock = jest.mocked(countPendingOperations);
const recordFailureMock = jest.mocked(recordFailure);
const removeOperationsMock = jest.mocked(removeOperations);

const buildEntry = (overrides: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 'op-1',
  entity: 'workouts',
  op: 'upsert',
  rowId: 'w1',
  row: { id: 'w1' },
  occurredAt: '2026-08-27T10:00:00.000Z',
  attempts: 0,
  ...overrides,
});

const connection = {
  apiUrl: 'https://example.test/',
  getIdToken: () => Promise.resolve('id-token'),
};

const mockFetch = (body: unknown, ok = true, status = 200) => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
};

// 送信本文は JSON 文字列。型を絞ってから読む。
const jsonBody = (init: RequestInit): unknown =>
  JSON.parse(typeof init.body === 'string' ? init.body : '{}');

beforeEach(() => {
  jest.clearAllMocks();
  countPendingOperationsMock.mockResolvedValue(0);
});

describe('送るものが無いとき', () => {
  it('通信せずに 0 件で返す', async () => {
    const fetchMock = mockFetch({});
    listPendingOperationsMock.mockResolvedValue([]);

    const result = await pushPendingOperations(createFakeDatabase().database, connection);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, settled: 0, failed: 0, pending: 0 });
  });
});

describe('送信', () => {
  it('未送信の操作をまとめて送る', async () => {
    const fetchMock = mockFetch({
      appliedAt: '2026-08-27T10:00:01.000Z',
      results: [{ id: 'op-1', status: 'applied' }],
    });
    listPendingOperationsMock.mockResolvedValue([buildEntry()]);

    const result = await pushPendingOperations(createFakeDatabase().database, connection);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // 末尾のスラッシュを重ねない。
    expect(url).toBe('https://example.test/sync/operations');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer id-token');
    expect(jsonBody(init)).toEqual({
      operations: [
        {
          id: 'op-1',
          at: '2026-08-27T10:00:00.000Z',
          op: 'upsert',
          entity: 'workouts',
          row: { id: 'w1' },
        },
      ],
    });
    expect(result.sent).toBe(1);
    expect(result.settled).toBe(1);
  });

  it('削除は行ではなく rowId を送る', async () => {
    const fetchMock = mockFetch({ appliedAt: '', results: [{ id: 'op-1', status: 'applied' }] });
    listPendingOperationsMock.mockResolvedValue([
      buildEntry({ op: 'delete', row: null, rowId: 'w1' }),
    ]);

    await pushPendingOperations(createFakeDatabase().database, connection);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(jsonBody(init)).toMatchObject({
      operations: [{ op: 'delete', rowId: 'w1' }],
    });
  });

  it('確定した操作（適用・重複・後勝ちで負け）をキューから外す', async () => {
    mockFetch({
      appliedAt: '',
      results: [
        { id: 'op-1', status: 'applied' },
        { id: 'op-2', status: 'duplicate' },
        { id: 'op-3', status: 'stale' },
      ],
    });
    listPendingOperationsMock.mockResolvedValue([
      buildEntry({ id: 'op-1' }),
      buildEntry({ id: 'op-2' }),
      buildEntry({ id: 'op-3' }),
    ]);

    const result = await pushPendingOperations(createFakeDatabase().database, connection);

    expect(result.settled).toBe(3);
    expect(removeOperationsMock).toHaveBeenCalledWith(expect.anything(), [
      'op-1',
      'op-2',
      'op-3',
    ]);
  });
});

describe('拒否されたとき', () => {
  it('キューに残して理由を記録する', async () => {
    mockFetch({
      appliedAt: '',
      results: [{ id: 'op-1', status: 'rejected', error: 'invalid row' }],
    });
    listPendingOperationsMock.mockResolvedValue([buildEntry()]);
    countPendingOperationsMock.mockResolvedValue(1);

    const result = await pushPendingOperations(createFakeDatabase().database, connection);

    expect(result.failed).toBe(1);
    expect(result.pending).toBe(1);
    expect(recordFailureMock).toHaveBeenCalledWith(
      expect.anything(),
      ['op-1'],
      '1件拒否（例: invalid row）',
    );
  });

  it('5回拒否された操作は捨てる（キューを詰まらせない）', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFetch({ appliedAt: '', results: [{ id: 'op-1', status: 'rejected' }] });
    listPendingOperationsMock.mockResolvedValue([buildEntry({ attempts: 4 })]);

    await pushPendingOperations(createFakeDatabase().database, connection);

    expect(removeOperationsMock).toHaveBeenCalledWith(expect.anything(), ['op-1']);
    expect(recordFailureMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('壊れた操作', () => {
  it('行スナップショットを失った upsert は送らずに捨てる', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = mockFetch({});
    listPendingOperationsMock.mockResolvedValue([buildEntry({ row: null })]);

    const result = await pushPendingOperations(createFakeDatabase().database, connection);

    expect(removeOperationsMock).toHaveBeenCalledWith(expect.anything(), ['op-1']);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
    warn.mockRestore();
  });
});

describe('サーバの応答が異常なとき', () => {
  it('HTTP エラーは状況が分かる文言で投げる', async () => {
    mockFetch({}, false, 503);
    listPendingOperationsMock.mockResolvedValue([buildEntry()]);

    await expect(
      pushPendingOperations(createFakeDatabase().database, connection),
    ).rejects.toThrow('HTTP 503');
  });

  it('形式が違う応答では確定扱いにしない', async () => {
    mockFetch({ appliedAt: '' });
    listPendingOperationsMock.mockResolvedValue([buildEntry()]);

    await expect(
      pushPendingOperations(createFakeDatabase().database, connection),
    ).rejects.toThrow('応答形式が不正');
    expect(removeOperationsMock).not.toHaveBeenCalled();
  });
});
