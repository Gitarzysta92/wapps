import { Table, type QueryRunner } from 'typeorm';
import { defaultAccountPreferences } from '@domains/customer/preferences';
import { AccountPreferences1791676806000 } from './account-preferences.migration';

function fixture(existing = true) {
  const table = new Table({
    name: 'identity_preferences',
    columns: [
      { name: 'identityId', type: 'varchar', length: '128', isPrimary: true },
      { name: 'preferences', type: 'json' },
      { name: 'updatedAt', type: 'bigint', unsigned: true },
    ],
  });
  const metadata = { engine: 'InnoDB', collation: 'utf8mb4_bin' };
  const query = jest.fn(
    async (sql: string): Promise<unknown[]> =>
      sql.includes('information_schema') ? [metadata] : []
  );
  const runner = {
    hasTable: jest.fn(
      async (name: string) => name === 'identities' || existing
    ),
    getTable: jest.fn(async () => table),
    query,
  } as unknown as QueryRunner;
  return { table, metadata, query, runner };
}
describe('account preferences additive migration', () => {
  it('creates only its missing table and can resume after DDL', async () => {
    const f = fixture(false);
    await new AccountPreferences1791676806000().up(f.runner);
    expect(f.query.mock.calls[0][0]).toContain(
      'CREATE TABLE identity_preferences'
    );
    const resumed = fixture();
    await new AccountPreferences1791676806000().up(resumed.runner);
    expect(
      resumed.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))
    ).toBe(true);
  });
  it.each(['key', 'collation', 'engine', 'type', 'nullable', 'unsigned'])(
    'refuses incompatible %s without rewriting data',
    async (kind) => {
      const f = fixture();
      if (kind === 'key') f.table.columns[0].isPrimary = false;
      if (kind === 'collation') f.metadata.collation = 'utf8mb4_general_ci';
      if (kind === 'engine') f.metadata.engine = 'MyISAM';
      if (kind === 'type') f.table.columns[1].type = 'text';
      if (kind === 'nullable') f.table.columns[1].isNullable = true;
      if (kind === 'unsigned') f.table.columns[2].unsigned = false;
      await expect(
        new AccountPreferences1791676806000().up(f.runner)
      ).rejects.toThrow('Incompatible');
      expect(
        f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))
      ).toBe(true);
    }
  );
  it('validates existing values in bounded batches, rejecting orphaned and deleted accounts', async () => {
    const f = fixture();
    const row = {
      identityId: 'Uid',
      preferences: JSON.stringify(defaultAccountPreferences()),
      updatedAt: '100',
      revision: '2',
      identityUpdatedAt: '100',
      isDeleted: 0,
    };
    f.query.mockImplementation(async (sql: string) =>
      sql.includes('information_schema') ? [f.metadata] : [row]
    );
    await new AccountPreferences1791676806000().up(f.runner);
    expect(f.query.mock.calls[1][0]).toContain('LIMIT 256');
    for (const invalid of [
      { isDeleted: 1 },
      { isDeleted: null },
      { preferences: '{}' },
      { updatedAt: '200' },
      { revision: 0 },
    ]) {
      f.query.mockImplementation(async (sql: string) =>
        sql.includes('information_schema')
          ? [f.metadata]
          : [{ ...row, ...invalid }]
      );
      await expect(
        new AccountPreferences1791676806000().up(f.runner)
      ).rejects.toThrow();
    }
  });
  it('refuses destructive down migration', async () => {
    await expect(new AccountPreferences1791676806000().down()).rejects.toThrow(
      'data-preserving'
    );
  });
});
