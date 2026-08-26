import { createFakeDatabase } from '../../test-support/fakeDatabase';
import { applyBackupPayload, fetchBackupFromCloud } from '../sync';

const payload = {
  exportedAt: '2026-08-27T10:00:00.000Z',
  tables: {
    workouts: [
      {
        id: 'w1',
        performed_at: '2026-08-27',
        status: 'completed',
        memo: '',
        last_saved_at: '2026-08-27T10:00:00.000Z',
        created_at: '2026-08-27T09:00:00.000Z',
        updated_at: '2026-08-27T10:00:00.000Z',
        deleted_at: null,
      },
    ],
  },
};

describe('applyBackupPayload', () => {
  it('取り込む前に既存の行を消す', async () => {
    const fake = createFakeDatabase();

    await applyBackupPayload(fake.database, payload);

    expect(fake.runsMatching('DELETE FROM workouts')).toHaveLength(1);
    expect(fake.runsMatching('INSERT INTO workouts')).toHaveLength(1);
  });

  it('子テーブルから消す（外部キーの順序）', async () => {
    const fake = createFakeDatabase();

    await applyBackupPayload(fake.database, payload);

    const deletes = fake.runsMatching('DELETE FROM').map((run) => run.sql);
    expect(deletes.indexOf('DELETE FROM workout_sets')).toBeLessThan(
      deletes.indexOf('DELETE FROM workouts'),
    );
  });

  it('種目より後に種目の目標を入れる（親を先に置く）', async () => {
    const fake = createFakeDatabase();

    await applyBackupPayload(fake.database, payload);

    const inserts = fake.runsMatching('DELETE FROM').map((run) => run.sql);
    // 削除は逆順なので、exercise_goals の削除は exercises より先になる。
    expect(inserts.indexOf('DELETE FROM exercise_goals')).toBeLessThan(
      inserts.indexOf('DELETE FROM exercises'),
    );
  });

  it('送信待ちの操作を捨てる（サーバの内容を正にする）', async () => {
    const fake = createFakeDatabase();

    await applyBackupPayload(fake.database, payload);

    expect(fake.runsMatching('DELETE FROM sync_outbox')).toHaveLength(1);
  });

  it('真偽値は 0/1 に寄せる', async () => {
    const fake = createFakeDatabase();

    await applyBackupPayload(fake.database, {
      exportedAt: '2026-08-27T10:00:00.000Z',
      tables: {
        workout_sets: [{ id: 's1', is_warmup: true, is_completed: false }],
      },
    });

    const [insert] = fake.runsMatching('INSERT INTO workout_sets');
    expect(insert.params).toContain(1);
    expect(insert.params).toContain(0);
  });

  it('列に無い値は null で埋める', async () => {
    const fake = createFakeDatabase();

    await applyBackupPayload(fake.database, {
      exportedAt: '2026-08-27T10:00:00.000Z',
      tables: { workouts: [{ id: 'w1' }] },
    });

    const [insert] = fake.runsMatching('INSERT INTO workouts');
    expect(insert.params[0]).toBe('w1');
    expect(insert.params.filter((param) => param === null).length).toBeGreaterThan(0);
  });

  it('形式違反の値では取り込み全体を失敗させる', async () => {
    const fake = createFakeDatabase();

    await expect(
      applyBackupPayload(fake.database, {
        exportedAt: '2026-08-27T10:00:00.000Z',
        tables: { workouts: [{ id: 'w1', memo: { nested: true } }] },
      }),
    ).rejects.toThrow('applyBackupPayload failed');
  });
});

describe('fetchBackupFromCloud', () => {
  const mockFetch = (body: unknown, ok = true, status = 200) => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    });
    globalThis.fetch = fetchMock;
    return fetchMock;
  };

  it('末尾のスラッシュを重ねずに取りに行く', async () => {
    const fetchMock = mockFetch(payload);

    await fetchBackupFromCloud('https://example.test/', 'id-token');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.test/backup');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer id-token');
  });

  it('HTTP エラーは状況が分かる文言で投げる', async () => {
    mockFetch({}, false, 401);

    await expect(fetchBackupFromCloud('https://example.test', 'id-token')).rejects.toThrow(
      'HTTP 401',
    );
  });

  it('形が違う応答は受け取らない（消してから気づかないため）', async () => {
    mockFetch({ exportedAt: '2026-08-27T10:00:00.000Z', tables: { workouts: 'not-an-array' } });

    await expect(fetchBackupFromCloud('https://example.test', 'id-token')).rejects.toThrow(
      '形式が不正',
    );
  });
});
