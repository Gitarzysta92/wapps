import type { DataSource, EntityManager } from 'typeorm';
import { MysqlIdentityEvents } from './mysql-identity-events';
import { MysqlIdentityDeletions } from './mysql-identity-deletions';

function fixture() {
  const query = jest.fn();
  const direct = jest.fn();
  const transaction = jest.fn(
    async (
      _isolation: string,
      run: (manager: EntityManager) => Promise<unknown>
    ) => run({ query } as unknown as EntityManager)
  );
  const source = { query: direct, transaction } as unknown as DataSource;
  return {
    query,
    direct,
    transaction,
    events: new MysqlIdentityEvents(source),
    deletions: new MysqlIdentityDeletions(source),
  };
}

describe('SQL identity journals', () => {
  it('claims a due event with a recoverable lease and row lock', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([
        {
          id: 'event',
          identityId: 'Uid',
          revision: '2',
          attempts: 0,
          body: '{}',
          eventType: 'identity.updated',
        },
      ])
      .mockResolvedValueOnce({ affectedRows: 1 });
    expect(await f.events.claim(100, 'lease')).toMatchObject({
      id: 'event',
      revision: 2,
    });
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(f.query.mock.calls[0][0]).toContain('failedAt IS NULL');
    expect(f.query.mock.calls[1][1]).toEqual(['lease', 30100, 'event']);
    expect(f.direct).not.toHaveBeenCalled();
  });
  it('lets the application quarantine malformed attempts without starving later work', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([{ id: 'event', attempts: -1, revision: '2' }])
      .mockResolvedValueOnce({});
    expect(await f.events.claim(100, 'lease')).toMatchObject({ attempts: -1 });
    expect(f.query).toHaveBeenCalledTimes(2);
  });
  it.each(['events', 'deletions'] as const)(
    'fences %s completion and retry persistence',
    async (journal) => {
      const f = fixture();
      f.direct.mockResolvedValue({ affectedRows: 0 });
      const result =
        journal === 'events'
          ? await f.events.delivered('id', 'old-lease', 100)
          : await f.deletions.complete('id', 'old-lease', 100);
      expect(result).toBe(false);
      expect(f.direct.mock.calls[0][0]).toContain('leaseToken = ?');
      expect(f.direct.mock.calls[0][1]).toEqual([100, 'id', 'old-lease']);
      await f[journal].failed('id', 'old-lease', 1, 2100, null);
      expect(f.direct.mock.calls[1][0]).toContain('leaseToken = ?');
      expect(f.direct.mock.calls[1][1]).toEqual([
        1,
        2100,
        null,
        'id',
        'old-lease',
      ]);
    }
  );
  it.each([
    null,
    { is_deleted: 0, is_active: 1, revision: '2' },
    { is_deleted: 1, is_active: 0, revision: '1' },
    { is_deleted: 1, is_active: 0, revision: '9007199254740992' },
  ])(
    'never authorizes cleanup from an invalid current tombstone: %j',
    async (state) => {
      const f = fixture();
      f.query
        .mockResolvedValueOnce([
          { identityId: 'Uid', revision: '2', attempts: 0 },
        ])
        .mockResolvedValueOnce(state ? [state] : [])
        .mockResolvedValueOnce({});
      expect(await f.deletions.claim(100, 'lease')).toMatchObject({
        tombstone: false,
      });
    }
  );
  it('uses the authoritative tombstone to qualify credential cleanup', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([
        { identityId: 'Uid', revision: '2', attempts: 0 },
      ])
      .mockResolvedValueOnce([{ is_deleted: 1, is_active: 0, revision: '2' }])
      .mockResolvedValueOnce({});
    expect(await f.deletions.claim(100, 'lease')).toEqual({
      identityId: 'Uid',
      revision: 2,
      attempts: 0,
      tombstone: true,
    });
  });
});
