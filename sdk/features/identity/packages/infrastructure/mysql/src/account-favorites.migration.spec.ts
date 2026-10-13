import { Table, TableIndex, type QueryRunner } from 'typeorm';
import { AccountFavorites1791676807000 } from './account-favorites.migration';

function fixture(existing = true) {
  const table = new Table({
    name: 'identity_favorites',
    columns: [
      { name: 'identityId', type: 'varchar', length: '128', isPrimary: true },
      { name: 'targetKind', type: 'varchar', length: '16', isPrimary: true },
      { name: 'targetId', type: 'varchar', length: '36', isPrimary: true },
      { name: 'addedAt', type: 'bigint', unsigned: true },
    ],
  });
  const metadata = table.columns.map((column) => ({
    name: column.name,
    engine: 'InnoDB',
    collation: 'utf8mb4_bin',
  }));
  const primary = { keyColumns: 'identityId,targetKind,targetId' };
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>(
    async (sql) =>
      sql.includes('information_schema.STATISTICS')
        ? [primary]
        : sql.includes('information_schema')
        ? metadata
        : []
  );
  const runner = {
    hasTable: jest.fn(
      async (name: string) => name === 'identities' || existing
    ),
    getTable: jest.fn(async () => table),
    query,
  } as unknown as QueryRunner;
  return { table, metadata, primary, query, runner };
}
describe('favorites additive migration', () => {
  it('creates only a missing canonical table and safely resumes validation', async () => {
    const f = fixture(false);
    await new AccountFavorites1791676807000().up(f.runner);
    expect(f.query.mock.calls[0][0]).toContain(
      'CREATE TABLE identity_favorites'
    );
    const resumed = fixture();
    await new AccountFavorites1791676807000().up(resumed.runner);
    expect(
      resumed.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))
    ).toBe(true);
  });
  it('uses actual key order, independent of TypeORM column enumeration', async () => {
    const f = fixture();
    f.table.columns.reverse();
    await new AccountFavorites1791676807000().up(f.runner);
    f.primary.keyColumns = 'targetId,targetKind,identityId';
    await expect(
      new AccountFavorites1791676807000().up(f.runner)
    ).rejects.toThrow('primary key');
  });
  it.each([
    'key',
    'collation',
    'engine',
    'nullable',
    'unsigned',
    'length',
    'extra-unique',
  ])('rejects incompatible %s without overwriting data', async (kind) => {
    const f = fixture();
    if (kind === 'key') f.table.columns[0].isPrimary = false;
    if (kind === 'collation') f.metadata[0].collation = 'utf8mb4_general_ci';
    if (kind === 'engine') f.metadata[0].engine = 'MyISAM';
    if (kind === 'nullable') f.table.columns[1].isNullable = true;
    if (kind === 'unsigned') f.table.columns[3].unsigned = false;
    if (kind === 'length') f.table.columns[2].length = '80';
    if (kind === 'extra-unique')
      f.table.indices.push(
        new TableIndex({
          name: 'one_per_target',
          columnNames: ['targetId'],
          isUnique: true,
        })
      );
    await expect(
      new AccountFavorites1791676807000().up(f.runner)
    ).rejects.toThrow('Incompatible');
    expect(f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(
      true
    );
  });
  it('rejects orphaned/deleted identities, invalid canonical IDs and invalid timestamps', async () => {
    const f = fixture();
    const row = {
      identityId: 'Uid',
      targetKind: 'applications',
      targetId: '019a0010-0000-7000-8000-000000000001',
      addedAt: 100,
      identityUpdatedAt: 100,
      revision: 2,
      isDeleted: 0,
    };
    for (const override of [
      {},
      { isDeleted: null },
      { isDeleted: 1 },
      { targetId: 'slug' },
      { addedAt: 101 },
      { identityUpdatedAt: 'invalid' },
      { revision: 0 },
    ]) {
      f.query.mockImplementation(async (sql: string) =>
        sql.includes('information_schema.STATISTICS')
          ? [f.primary]
          : sql.includes('information_schema')
          ? f.metadata
          : [{ ...row, ...override }]
      );
      const operation = new AccountFavorites1791676807000().up(f.runner);
      if (!Object.keys(override).length) await operation;
      else await expect(operation).rejects.toThrow();
    }
    expect(f.query.mock.calls.some(([sql]) => sql.includes('LIMIT 256'))).toBe(
      true
    );
  });
  it('counts account favorites across batch boundaries', async () => {
    const f = fixture();
    const make = (uid: string, i: number) => ({
      identityId: uid,
      targetKind: 'applications',
      targetId: `019a0010-0000-7000-8000-${i.toString(16).padStart(12, '0')}`,
      addedAt: 100,
      identityUpdatedAt: 100,
      revision: 2,
      isDeleted: 0,
    });
    f.query
      .mockResolvedValueOnce(f.metadata)
      .mockResolvedValueOnce([f.primary])
      .mockResolvedValueOnce([
        ...Array.from({ length: 100 }, (_, i) => make('A', i)),
        ...Array.from({ length: 156 }, (_, i) => make('B', i)),
      ])
      .mockResolvedValueOnce(
        Array.from({ length: 45 }, (_, i) => make('B', 156 + i))
      );
    await expect(
      new AccountFavorites1791676807000().up(f.runner)
    ).rejects.toThrow('exceeded limit');
    expect(f.query.mock.calls[3][1]).toEqual([
      'B',
      'B',
      'applications',
      make('B', 155).targetId,
    ]);
  });
  it('refuses destructive rollback', async () =>
    await expect(new AccountFavorites1791676807000().down()).rejects.toThrow(
      'data-preserving'
    ));
});
