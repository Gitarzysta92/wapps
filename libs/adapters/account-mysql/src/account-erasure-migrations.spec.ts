import { Table, TableIndex, type QueryRunner } from 'typeorm';
import { AccountErasureRequests1791840001000 } from './account-erasure-requests.migration';
import { AccountErasureCoordination1791840002000 } from './account-erasure-coordination.migration';

function fixture(kind: 'requests' | 'coordination') {
  const names =
    kind === 'requests'
      ? ['revision', 'requestedAt', 'completedAt']
      : [
          'revision',
          'createdAt',
          'availableAt',
          'leasedUntil',
          'completedAt',
          'failedAt',
        ];
  const pending =
    kind === 'requests'
      ? ['completedAt', 'identityId']
      : ['completedAt', 'failedAt', 'availableAt', 'leasedUntil'];
  const table = new Table({
    name:
      kind === 'requests'
        ? 'identity_erasure_requests'
        : 'identity_erasure_jobs',
    columns: [
      { name: 'identityId', type: 'varchar', length: '128', isPrimary: true },
      ...names.map((name) => ({
        name,
        type: 'bigint',
        unsigned: true,
        isNullable: ['completedAt', 'failedAt', 'leasedUntil'].includes(name),
      })),
    ],
    indices: [new TableIndex({ name: 'idx_pending', columnNames: pending })],
  });
  const metadata = table.columns.map((column) => ({
    name: column.name,
    engine: 'InnoDB',
    collation: column.type === 'varchar' ? 'utf8mb4_bin' : null,
  }));
  const indexes = [
    {
      columns: pending.join(','),
      columnCount: String(pending.length),
      prefix: null as number | null,
      nonUnique: '1',
    },
  ];
  const query = jest.fn<Promise<unknown[]>, [string, unknown[]?]>(
    async (sql) => {
      if (sql.includes('information_schema.STATISTICS')) return indexes;
      if (sql.includes('information_schema.TABLES')) return metadata;
      return [];
    }
  );
  const original = table.clone();
  const runner = {
    connection: {
      options: {},
      driver: { escape: (name: string) => `\`${name}\`` },
    },
    hasTable: jest.fn(async () => true),
    getTable: jest.fn(async (name: string) =>
      name === 'identity_deletion_jobs' ? original : table
    ),
    query,
  } as unknown as QueryRunner;
  const migration =
    kind === 'requests'
      ? new AccountErasureRequests1791840001000()
      : new AccountErasureCoordination1791840002000();
  return { runner, table, indexes, query, migration };
}

describe.each(['requests', 'coordination'] as const)(
  'account erasure %s index validation',
  (kind) => {
    it('uses actual key order when ORM metadata enumerates columns differently', async () => {
      const f = fixture(kind);
      f.table.columns.reverse();
      f.table.indices[0].columnNames.reverse();
      await f.migration.up(f.runner);
      expect(f.query).toHaveBeenCalledWith(
        expect.stringContaining('COLUMN_NAME ORDER BY SEQ_IN_INDEX')
      );
    });

    it.each(['order', 'missing', 'prefix', 'unique', 'expression'])(
      'rejects an incompatible %s even when ORM metadata looks correct',
      async (change) => {
        const f = fixture(kind);
        const index = f.indexes[0];
        if (change === 'order')
          index.columns = index.columns.split(',').reverse().join(',');
        if (change === 'missing') f.indexes.pop();
        if (change === 'prefix') index.prefix = 16;
        if (change === 'unique') index.nonUnique = '0';
        if (change === 'expression')
          index.columnCount = String(Number(index.columnCount) + 1);
        await expect(f.migration.up(f.runner)).rejects.toThrow(
          'Incompatible account erasure'
        );
        expect(
          f.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))
        ).toBe(true);
      }
    );
  }
);
