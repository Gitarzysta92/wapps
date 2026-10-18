import { createHash } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import {
  defaultAccountPreferences,
  parsePreferencesUpdate,
} from '@domains/customer/preferences';
import { MysqlCanonicalIdentities } from './mysql-canonical-identities';

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
const input = { expectedRevision: 2, preferences: defaultAccountPreferences() };
function fixture() {
  const query = jest.fn().mockResolvedValue([]);
  const transaction = jest.fn(
    async (
      _isolation: string,
      run: (manager: EntityManager) => Promise<unknown>
    ) => run({ query } as unknown as EntityManager)
  );
  const store = new MysqlCanonicalIdentities(
    { transaction } as unknown as DataSource,
    () => 200
  );
  return { query, transaction, store };
}
describe('canonical account preferences', () => {
  it('reads defaults without writes for an active unconfigured account', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([row]);
    expect(await f.store.getPreferences('Uid')).toEqual({
      identityId: 'Uid',
      revision: 2,
      updatedAt: null,
      preferences: defaultAccountPreferences(),
    });
    expect(f.transaction.mock.calls[0][0]).toBe('REPEATABLE READ');
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });
  it('commits preferences, revision, receipt and private-data-free invalidation under one lock', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([row]);
    expect(await f.store.updatePreferences('Uid', input, 'key')).toEqual({
      identityId: 'Uid',
      revision: 3,
    });
    expect(f.transaction.mock.calls[0][0]).toBe('READ COMMITTED');
    expect(f.query.mock.calls[0][0]).toContain('FOR UPDATE');
    const sql = f.query.mock.calls.map(([sql]) => sql);
    expect(sql[2]).toContain('INSERT INTO identity_preferences');
    expect(sql[3]).toContain('UPDATE identities');
    expect(sql[4]).toContain('INSERT INTO identity_account_commands');
    expect(sql[5]).toContain('INSERT INTO identity_events_outbox');
    expect(JSON.stringify(f.query.mock.calls[5])).not.toContain(
      'profileVisibility'
    );
  });
  it('replays its original receipt after a later account change, but never mixes command kinds', async () => {
    const f = fixture();
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          operation: 'preferences-update-v1',
          ...parsePreferencesUpdate(input),
        })
      )
      .digest('hex');
    f.query
      .mockResolvedValueOnce([{ ...row, revision: 5 }])
      .mockResolvedValueOnce([{ fingerprint, revision: 3 }]);
    expect(await f.store.updatePreferences('Uid', input, 'key')).toEqual({
      identityId: 'Uid',
      revision: 3,
    });
    expect(f.query).toHaveBeenCalledTimes(2);
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ fingerprint: 'profile-command', revision: 3 }]);
    await expect(
      f.store.updatePreferences('Uid', input, 'key')
    ).rejects.toThrow('another command');
  });
  it.each([
    { is_active: 0 },
    { is_suspended: 1 },
    { is_active: 0, is_deleted: 1, deleted_at: 100 },
  ])(
    'checks lifecycle before reading/replaying preferences: %j',
    async (state) => {
      const f = fixture();
      f.query.mockResolvedValue([{ ...row, ...state }]);
      await expect(f.store.getPreferences('Uid')).rejects.toThrow(
        'unavailable'
      );
      await expect(
        f.store.updatePreferences('Uid', input, 'key')
      ).rejects.toThrow('unavailable');
      expect(f.query).toHaveBeenCalledTimes(2);
    }
  );
  it('rejects stale writes and malformed stored JSON rather than returning defaults', async () => {
    const f = fixture();
    f.query.mockResolvedValueOnce([{ ...row, revision: 3 }]);
    await expect(
      f.store.updatePreferences('Uid', input, 'key')
    ).rejects.toThrow('revision changed');
    expect(f.query).toHaveBeenCalledTimes(2);
    f.query
      .mockResolvedValueOnce([row])
      .mockResolvedValueOnce([{ preferences: '{}', updatedAt: 100 }]);
    await expect(f.store.getPreferences('Uid')).rejects.toThrow(
      'Invalid stored preferences'
    );
  });
  it('propagates outbox failure from inside the transaction', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM identities')) return [row];
      if (sql.includes('INSERT INTO identity_events_outbox'))
        throw new Error('outbox down');
      return [];
    });
    await expect(
      f.store.updatePreferences('Uid', input, 'key')
    ).rejects.toThrow('outbox down');
    expect(f.transaction).toHaveBeenCalledTimes(1);
  });
  it('rejects malformed input before starting a transaction', async () => {
    const f = fixture();
    await expect(
      f.store.updatePreferences(
        'Uid',
        { ...input, preferences: {} as never },
        'key'
      )
    ).rejects.toThrow('Invalid preferences');
    expect(f.transaction).not.toHaveBeenCalled();
  });
});
