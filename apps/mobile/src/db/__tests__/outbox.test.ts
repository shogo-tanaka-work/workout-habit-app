import { createFakeDatabase } from '../../test-support/fakeDatabase';
import {
  countPendingOperations,
  enqueueDelete,
  enqueueUpsert,
  listPendingOperations,
  recordFailure,
  removeOperations,
} from '../outbox';

describe('enqueueUpsert', () => {
  it('行のスナップショットを積む', async () => {
    const fake = createFakeDatabase({
      getFirst: () => ({ id: 'w1', performed_at: '2026-08-27' }),
      // UPDATE（既存の未送信 upsert への差し替え）は 0 件＝新規に積む。
      changes: () => 0,
    });

    await enqueueUpsert(fake.database, 'workouts', 'w1');

    const [insert] = fake.runsMatching('INSERT INTO sync_outbox');
    expect(insert.params).toContain('workouts');
    expect(insert.params).toContain('upsert');
    expect(insert.params).toContain(JSON.stringify({ id: 'w1', performed_at: '2026-08-27' }));
  });

  it('未送信の upsert があれば積み直さず中身だけ差し替える', async () => {
    const fake = createFakeDatabase({
      getFirst: () => ({ id: 'w1' }),
      changes: () => 1,
    });

    await enqueueUpsert(fake.database, 'workouts', 'w1');

    expect(fake.runsMatching('UPDATE sync_outbox')).toHaveLength(1);
    expect(fake.runsMatching('INSERT INTO sync_outbox')).toHaveLength(0);
  });

  it('行が消えていれば何も積まない', async () => {
    const fake = createFakeDatabase({ getFirst: () => null });

    await enqueueUpsert(fake.database, 'workouts', 'gone');

    expect(fake.runs).toHaveLength(0);
  });
});

describe('enqueueDelete', () => {
  it('行が無くても削除は記録する（明示的な操作として送る）', async () => {
    const fake = createFakeDatabase({ getFirst: () => null });

    await enqueueDelete(fake.database, 'workouts', 'w1');

    const [insert] = fake.runsMatching('INSERT INTO sync_outbox');
    expect(insert.params).toContain('delete');
    expect(insert.params).toContain(null);
  });
});

describe('listPendingOperations', () => {
  it('行をドメイン型へ直し、payload を復元する', async () => {
    const fake = createFakeDatabase({
      getAll: () => [
        {
          id: 'op-1',
          entity: 'workouts',
          op: 'upsert',
          row_id: 'w1',
          payload: '{"id":"w1"}',
          occurred_at: '2026-08-27T10:00:00.000Z',
          attempts: 0,
        },
      ],
    });

    const entries = await listPendingOperations(fake.database);

    expect(entries[0]).toEqual({
      id: 'op-1',
      entity: 'workouts',
      op: 'upsert',
      rowId: 'w1',
      row: { id: 'w1' },
      occurredAt: '2026-08-27T10:00:00.000Z',
      attempts: 0,
    });
  });

  it('壊れた payload でも送信を止めない（null にして残す）', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = createFakeDatabase({
      getAll: () => [
        {
          id: 'op-1',
          entity: 'workouts',
          op: 'upsert',
          row_id: 'w1',
          payload: '{壊れた',
          occurred_at: '2026-08-27T10:00:00.000Z',
          attempts: 1,
        },
      ],
    });

    const entries = await listPendingOperations(fake.database);

    expect(entries[0].row).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('payload が配列なら受け付けない', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = createFakeDatabase({
      getAll: () => [
        {
          id: 'op-1',
          entity: 'workouts',
          op: 'upsert',
          row_id: 'w1',
          payload: '[]',
          occurred_at: '2026-08-27T10:00:00.000Z',
          attempts: 0,
        },
      ],
    });

    const entries = await listPendingOperations(fake.database);

    expect(entries[0].row).toBeNull();
    warn.mockRestore();
  });
});

describe('countPendingOperations', () => {
  it('件数を返す', async () => {
    const fake = createFakeDatabase({ getFirst: () => ({ count: 3 }) });
    expect(await countPendingOperations(fake.database)).toBe(3);
  });

  it('行が取れなければ 0', async () => {
    const fake = createFakeDatabase({ getFirst: () => null });
    expect(await countPendingOperations(fake.database)).toBe(0);
  });
});

describe('removeOperations / recordFailure', () => {
  it('空の指定では SQL を投げない', async () => {
    const fake = createFakeDatabase();

    await removeOperations(fake.database, []);
    await recordFailure(fake.database, [], 'エラー');

    expect(fake.runs).toHaveLength(0);
  });

  it('指定した件数ぶんのプレースホルダで消す', async () => {
    const fake = createFakeDatabase();

    await removeOperations(fake.database, ['op-1', 'op-2']);

    const [remove] = fake.runsMatching('DELETE FROM sync_outbox');
    expect(remove.sql).toContain('IN (?, ?)');
    expect(remove.params).toEqual(['op-1', 'op-2']);
  });

  it('失敗は回数を増やして理由を残す（キューからは消さない）', async () => {
    const fake = createFakeDatabase();

    await recordFailure(fake.database, ['op-1'], '通信に失敗');

    const [update] = fake.runsMatching('UPDATE sync_outbox');
    expect(update.sql).toContain('attempts = attempts + 1');
    expect(update.params).toEqual(['通信に失敗', 'op-1']);
    expect(fake.runsMatching('DELETE')).toHaveLength(0);
  });
});
