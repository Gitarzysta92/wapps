import type { DataSource, EntityManager } from 'typeorm';
import { createHash } from 'node:crypto';
import {
  type FavoriteChange,
  parseFavoriteChange,
} from '@domains/customer/favorites';
import { MysqlAccountFavorites } from './mysql-account-favorites';

const row = {
  id: '00000000-0000-4000-8000-000000000001',
  identity_id: 'Uid',
  claim: 'Uid',
  kind: 'user',
  provider_type: 'email',
  is_active: 1,
  is_suspended: 0,
  is_deleted: 0,
  revision: '2',
  created_at: '100',
  updated_at: '100',
  deleted_at: '0',
};
const input: FavoriteChange = {
  expectedRevision: 2,
  target: { kind: 'applications', id: '019a0010-0000-7000-8000-000000000001' },
  saved: true,
};
const fingerprint = createHash('sha256')
  .update(
    JSON.stringify({
      operation: 'favorite-change-v1',
      ...parseFavoriteChange(input),
    })
  )
  .digest('hex');
function fixture() {
  const query = jest.fn().mockResolvedValue([]);
  const transaction = jest.fn(
    async (
      _isolation: string,
      work: (manager: EntityManager) => Promise<unknown>
    ) => work({ query } as unknown as EntityManager)
  );
  const store = new MysqlAccountFavorites(
    { transaction } as unknown as DataSource,
    () => 200
  );
  return { store, transaction, query };
}
describe('canonical favorites SQL protocol', () => {
  it('reads only the current account in a bounded consistent snapshot without seeding data', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([row]);
    expect(await f.store.read('Uid')).toEqual({
      identityId: 'Uid',
      revision: 2,
      favorites: [],
    });
    expect(f.transaction.mock.calls[0][0]).toBe('REPEATABLE READ');
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE identityId = ? ORDER BY'),
      ['Uid', 201]
    );
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });
  it('commits a relation, account revision, receipt and data-free invalidation atomically', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([row]);
    expect(
      await f.store.change('Uid', input, 'key', { version: 1, at: 100 })
    ).toEqual({
      identityId: 'Uid',
      revision: 3,
    });
    expect(f.transaction.mock.calls[0][0]).toBe('READ COMMITTED');
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE');
    const mutations = f.query.mock.calls.filter(
      ([sql]) => !sql.startsWith('SELECT')
    );
    expect(
      mutations.map(([sql]) => sql.split(' ').slice(0, 3).join(' '))
    ).toEqual([
      'INSERT INTO identity_favorite_watches',
      'INSERT INTO identity_favorites',
      'UPDATE identities SET',
      'INSERT INTO identity_account_commands',
      'INSERT INTO identity_events_outbox',
    ]);
    expect(mutations[0][1]).toEqual([
      'Uid',
      'applications',
      input.target.id,
      expect.any(String),
      1,
      100,
      200,
    ]);
    expect(mutations[1][1]).toEqual([
      'Uid',
      'applications',
      input.target.id,
      200,
    ]);
    expect(JSON.stringify(mutations[4][1])).not.toContain(input.target.id);
  });
  it('inspects and replays receipts without modifying data or requiring the old account revision', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM identities')
        ? [{ ...row, revision: 5 }]
        : [{ fingerprint, revision: 3 }]
    );
    expect(await f.store.inspectChange('Uid', input, 'key')).toEqual({
      identityId: 'Uid',
      revision: 3,
    });
    expect(
      await f.store.change('Uid', input, 'key', { version: 1, at: 100 })
    ).toEqual({
      identityId: 'Uid',
      revision: 3,
    });
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });
  it.each([
    { is_active: 0 },
    { is_suspended: 1 },
    { is_active: 0, is_deleted: 1, deleted_at: 100 },
  ])(
    'enforces account lifecycle before replay/read/write: %j',
    async (override) => {
      const f = fixture();
      f.query.mockResolvedValue([{ ...row, ...override }]);
      await expect(f.store.read('Uid')).rejects.toThrow('unavailable');
      await expect(f.store.inspectChange('Uid', input, 'key')).rejects.toThrow(
        'unavailable'
      );
      await expect(
        f.store.change('Uid', input, 'key', { version: 1, at: 100 })
      ).rejects.toThrow('unavailable');
      expect(f.query).toHaveBeenCalledTimes(3);
    }
  );
  it('rejects wrong-case identity mappings, conflicting keys and invalid receipt revisions', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([
      { ...row, identity_id: 'uid', claim: 'uid' },
    ]);
    await expect(f.store.read('Uid')).rejects.toThrow(
      'different case-sensitive'
    );
    for (const receipt of [
      { fingerprint: 'different-command', revision: 3 },
      { fingerprint, revision: 4 },
    ]) {
      f.query.mockResolvedValueOnce([row]).mockResolvedValueOnce([receipt]);
      await expect(
        f.store.inspectChange('Uid', input, 'key')
      ).rejects.toThrow();
    }
  });
  it('rechecks revision under the write lock after a successful preflight', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([row]);
    expect(await f.store.inspectChange('Uid', input, 'key')).toBeNull();
    f.query.mockResolvedValueOnce([{ ...row, revision: 3 }]);
    await expect(
      f.store.change('Uid', input, 'key', { version: 1, at: 100 })
    ).rejects.toThrow('revision changed');
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });
  it('preserves the first saved timestamp when already present, and bounds new additions', async () => {
    const f = fixture();
    const targets = Array.from({ length: 200 }, (_, index) => ({
      targetKind: 'applications',
      addedAt: 100,
      targetId: `019a0010-0000-7000-8000-${(index + 1)
        .toString(16)
        .padStart(12, '0')}`,
    }));
    f.query.mockImplementation(async (sql: string) =>
      sql.includes('FROM identities')
        ? [row]
        : sql.includes('FROM identity_favorites')
        ? targets
        : []
    );
    await f.store.change('Uid', input, 'key', { version: 1, at: 100 });
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO identity_favorites')
      )
    ).toBe(false);
    await expect(
      f.store.change(
        'Uid',
        {
          ...input,
          target: {
            ...input.target,
            id: '019a0010-0000-7000-8000-000000000999',
          },
        },
        'other',
        { version: 1, at: 100 }
      )
    ).rejects.toThrow('limit reached');
  });
  it('deletes only the selected account relation and advances the aggregate even for absence', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([row]);
    await f.store.change('Uid', { ...input, saved: false }, 'key', null);
    expect(f.query).toHaveBeenCalledWith(
      'DELETE FROM identity_favorites WHERE identityId = ? AND targetKind = ? AND targetId = ?',
      ['Uid', 'applications', input.target.id]
    );
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('identity_events_outbox'),
      expect.any(Array)
    );
  });
  it('rejects malformed stored references and propagates outbox failure inside the transaction', async () => {
    const f = fixture();
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([
        { targetKind: 'applications', targetId: 'slug', addedAt: 100 },
      ]);
    await expect(f.store.read('Uid')).rejects.toThrow(
      'Invalid stored favorites'
    );
    f.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM identities')) return [row];
      if (sql.includes('INSERT INTO identity_events_outbox'))
        throw new Error('outbox unavailable');
      return [];
    });
    await expect(
      f.store.change('Uid', input, 'key', { version: 1, at: 100 })
    ).rejects.toThrow('outbox unavailable');
  });
  it('rejects invalid keys and unsafe revisions before opening a transaction', async () => {
    const f = fixture();
    await expect(f.store.change('Uid', input, 'k\n', null)).rejects.toThrow();
    await expect(
      f.store.change(
        'Uid',
        { ...input, expectedRevision: Number.MAX_SAFE_INTEGER },
        'key',
        null
      )
    ).rejects.toThrow();
    expect(f.transaction).not.toHaveBeenCalled();
  });
});
