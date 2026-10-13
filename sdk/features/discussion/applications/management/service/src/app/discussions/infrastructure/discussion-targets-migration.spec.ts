import { Table, type QueryRunner } from 'typeorm';
import { DiscussionApplicationTargets1791676823000 } from './discussion-application-targets.migration';

const names = ['tenantId', 'subjectKind', 'subjectId', 'createdAt', 'id'];
function fixture() {
  const index = names.map((name) => ({
    name,
    nonUnique: 1,
    prefixLength: null as number | null,
  }));
  const table = new Table({
    name: 'discussion_write_aggregates',
    columns: [
      { name: 'subjectKind', type: 'varchar', length: '16', isNullable: true },
    ],
    indices: [
      {
        name: 'idx_discussion_article_page',
        columnNames: [...names].reverse(),
      },
    ],
  });
  const runner = {
    hasTable: jest.fn().mockResolvedValue(false),
    getTable: jest.fn().mockResolvedValue(table),
    addColumn: jest.fn(),
    createIndex: jest.fn(),
    query: jest.fn(async (sql: string): Promise<unknown[]> => {
      if (sql.includes('information_schema.STATISTICS')) {
        expect(sql).toContain('ORDER BY SEQ_IN_INDEX');
        return index;
      }
      if (sql.includes('information_schema.TABLES'))
        return [{ ENGINE: 'InnoDB' }];
      if (sql.includes('information_schema.COLUMNS'))
        return [
          { COLLATION_NAME: 'utf8mb4_bin' },
          { COLLATION_NAME: 'utf8mb4_bin' },
        ];
      return [];
    }),
  };
  return {
    index,
    table,
    runner,
    migration: new DiscussionApplicationTargets1791676823000(),
  };
}

describe('discussion target protocol migration', () => {
  it('uses actual index sequence even when ORM introspection returns reversed columns', async () => {
    const { migration, runner } = fixture();
    await migration.up(runner as unknown as QueryRunner);
    expect(runner.addColumn).not.toHaveBeenCalled();
    expect(runner.createIndex).not.toHaveBeenCalled();
  });
  it.each(['sequence', 'unique', 'prefix', 'missing'] as const)(
    'rejects an incompatible actual index: %s',
    async (failure) => {
      const { migration, runner, index } = fixture();
      if (failure === 'sequence') index.reverse();
      if (failure === 'unique') index[0].nonUnique = 0;
      if (failure === 'prefix') index[0].prefixLength = 2;
      if (failure === 'missing') index.pop();
      await expect(
        migration.up(runner as unknown as QueryRunner)
      ).rejects.toThrow('Incompatible discussion target index');
    }
  );
  it('refuses a completed schema with a missing index instead of silently repairing it', async () => {
    const { migration, runner, table } = fixture();
    table.indices = [];
    runner.hasTable.mockResolvedValue(true);
    runner.query.mockImplementation(async (sql) =>
      sql.includes('FROM migrations') ? [{ id: 1 }] : []
    );
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('Completed discussion target index is missing');
    expect(runner.createIndex).not.toHaveBeenCalled();
  });
});
