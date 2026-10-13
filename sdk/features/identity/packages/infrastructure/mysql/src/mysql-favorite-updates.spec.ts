import type { DataSource, EntityManager } from 'typeorm';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import {
  favoriteUpdateReceiptRow,
  favoriteWatchRow,
  MysqlFavoriteUpdates,
} from './mysql-favorite-updates';

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const target = { kind: 'applications' as const, id: id(1) };
const lease = { identityId: 'alice', target, generation: id(2), token: id(3) };
const watch = {
  identityId: 'alice',
  targetKind: target.kind,
  targetId: target.id,
  generation: id(2),
  version: 1,
  sourceAt: 100,
  attempts: 1,
  availableAt: 100,
  leaseToken: id(3),
  leasedUntil: 3000,
  failedAt: null,
};
const account = {
  id: id(9),
  identity_id: 'alice',
  claim: 'alice',
  kind: 'user',
  provider_type: 'email',
  is_active: 1,
  is_suspended: 0,
  is_deleted: 0,
  revision: 2,
  created_at: 100,
  updated_at: 100,
  deleted_at: 0,
};
const state = {
  target,
  version: 2,
  at: 200,
  content: {
    title: 'App',
    destination: { kind: 'applications' as const, slug: 'app' },
  },
};
function fixture() {
  const rows = {
    watch: { ...watch },
    account: { ...account },
    preferences: defaultAccountPreferences(),
  };
  const query = jest.fn(async (sql: string): Promise<unknown> => {
    if (sql.includes('FROM identities')) return [rows.account];
    if (sql.includes('FROM identity_favorite_watches')) return [rows.watch];
    if (sql.includes('FROM identity_preferences'))
      return [{ preferences: rows.preferences, updatedAt: 100 }];
    if (sql.includes('FROM identity_favorites')) return [{ addedAt: 100 }];
    return [];
  });
  const transaction = jest.fn(
    async (_level: string, run: (tx: EntityManager) => Promise<unknown>) =>
      run({ query } as unknown as EntityManager)
  );
  return {
    rows,
    query,
    transaction,
    store: new MysqlFavoriteUpdates(
      { query, transaction } as unknown as DataSource,
      () => 2000
    ),
  };
}
describe('durable favorite update subscriptions', () => {
  it('commits a delivered receipt and the new source version in the same canonical account transaction', async () => {
    const f = fixture();
    await f.store.settle(lease, state);
    expect(f.query.mock.calls[0][0]).toContain('FROM identities');
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO identity_favorite_notifications'),
      [
        'alice',
        expect.any(String),
        lease.generation,
        target.kind,
        target.id,
        2,
        200,
        2000,
        1,
      ]
    );
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE identity_favorite_watches SET version='),
      [2, 200, 32000, lease.generation]
    );
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });
  it('does not advance observation when writing the durable receipt fails', async () => {
    const f = fixture(),
      original = f.query.getMockImplementation();
    f.query.mockImplementation(async (sql) => {
      if (sql.startsWith('INSERT INTO identity_favorite_notifications'))
        throw new Error('write failed');
      return original?.(sql);
    });
    await expect(f.store.settle(lease, state)).rejects.toThrow('write failed');
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.startsWith('UPDATE identity_favorite_watches')
      )
    ).toBe(false);
  });
  it('permanently consumes hidden, opted-out and suspended observations with suppressed receipts', async () => {
    for (const reason of ['hidden', 'disabled', 'suspended']) {
      const f = fixture();
      if (reason === 'disabled')
        f.rows.preferences.notifications.inApp.favoriteUpdates = false;
      if (reason === 'suspended') f.rows.account.is_suspended = 1;
      await f.store.settle(
        lease,
        reason === 'hidden' ? { ...state, content: null } : state
      );
      expect(f.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO identity_favorite_notifications'),
        [
          'alice',
          expect.any(String),
          lease.generation,
          target.kind,
          target.id,
          2,
          200,
          2000,
          0,
        ]
      );
    }
  });
  it('cannot write through erased identities or stale leases', async () => {
    for (const reason of ['erased', 'token', 'expired']) {
      const f = fixture();
      if (reason === 'erased') {
        f.rows.account.is_deleted = 1;
        f.rows.account.is_active = 0;
        f.rows.account.deleted_at = 100;
      }
      if (reason === 'token') f.rows.watch.leaseToken = id(8);
      if (reason === 'expired') f.rows.watch.leasedUntil = 1999;
      await f.store.settle(lease, state);
      expect(
        f.query.mock.calls.some(([sql]) => /^(INSERT|UPDATE)/.test(sql))
      ).toBe(false);
    }
  });
  it('initializes legacy subscriptions without history and ignores unchanged versions', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql) =>
      sql.includes('FROM identities')
        ? [account]
        : sql.includes('FROM identity_favorite_watches')
        ? [{ ...watch, version: null, sourceAt: null }]
        : sql.includes('FROM identity_favorites')
        ? [{ addedAt: 100 }]
        : []
    );
    await f.store.settle(lease, state);
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(
      false
    );
    const same = fixture();
    await same.store.settle(lease, { ...state, version: 1, at: 100 });
    expect(
      same.query.mock.calls.some(([sql]) => sql.startsWith('INSERT'))
    ).toBe(false);
  });
  it('rejects a regressed source without lowering the subscription version', async () => {
    const f = fixture();
    await expect(
      f.store.settle(lease, { ...state, version: 0, at: 0 })
    ).rejects.toThrow('regressed');
    expect(f.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(
      false
    );
  });
  it('charges attempts on claim, including expired workers, and quarantines the twelfth lost attempt', async () => {
    const f = fixture();
    f.rows.watch.leasedUntil = 1000;
    expect(await f.store.claim()).toMatchObject({
      identityId: 'alice',
      generation: id(2),
    });
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET attempts='),
      [2, expect.any(String), 32000, id(2)]
    );
    f.rows.watch.attempts = 12;
    expect(await f.store.claim()).toBeNull();
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET failedAt='),
      [2000, id(2)]
    );
  });
  it('bounds failures and requires the exact failed subscription generation for requeue', async () => {
    const f = fixture();
    f.rows.watch.attempts = 12;
    await f.store.fail(lease);
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET availableAt='),
      [302000, 2000, id(2)]
    );
    await expect(f.store.requeue(id(2), 0)).rejects.toThrow();
    expect(await f.store.requeue(id(2), 1000)).toBe(false);
    expect(f.query).toHaveBeenLastCalledWith(
      expect.stringContaining('AND failedAt=? AND leaseToken IS NULL'),
      [2000, id(2), 1000]
    );
  });
  it('validates retained watch and receipt rows instead of laundering corruption into success', () => {
    for (const value of [
      { ...watch, attempts: 13 },
      { ...watch, leaseToken: null },
      { ...watch, version: null },
      { ...watch, failedAt: 1000 },
    ])
      expect(() => favoriteWatchRow(value)).toThrow();
    const receipt = {
      ...watch,
      id: id(4),
      createdAt: 200,
      delivered: 1,
      readAt: null,
    };
    expect(favoriteUpdateReceiptRow(receipt).readAt).toBeNull();
    for (const value of [
      { ...receipt, readAt: 100 },
      { ...receipt, delivered: 0, readAt: 200 },
      { ...receipt, version: 0 },
    ])
      expect(() => favoriteUpdateReceiptRow(value)).toThrow();
  });
});
