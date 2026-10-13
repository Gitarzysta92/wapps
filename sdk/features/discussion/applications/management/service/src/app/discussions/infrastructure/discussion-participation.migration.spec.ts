import { Table, type QueryRunner } from 'typeorm';
import { DiscussionParticipation1791676824000 } from './discussion-participation.migration';

function fixture() {
  const table = new Table({
    name: 'discussion_write_nodes',
    columns: [
      {
        name: 'ownerIdentityId',
        type: 'varchar',
        length: '128',
        isNullable: false,
      },
    ],
    indices: [
      {
        name: 'idx_discussion_participant',
        columnNames: ['nodeId', 'discussionId', 'ownerIdentityId'],
      },
    ],
  });
  const columns = ['ownerIdentityId', 'discussionId', 'nodeId'].map((name) => ({
    name,
    nonUnique: 1,
    prefixLength: null as number | null,
  }));
  const schema = [{ ENGINE: 'InnoDB', COLLATION_NAME: 'utf8mb4_bin' }];
  const runner = {
    connection: {
      options: {},
      driver: { escape: (name: string) => `\`${name}\`` },
    },
    getTable: jest.fn().mockResolvedValue(table),
    hasTable: jest.fn().mockResolvedValue(false),
    createIndex: jest.fn(),
    query: jest.fn(async (sql: string): Promise<unknown[]> => {
      if (sql.includes('STATISTICS')) {
        expect(sql).toContain('ORDER BY SEQ_IN_INDEX');
        return columns;
      }
      if (sql.includes('TABLES')) return schema;
      return [];
    }),
  };
  return {
    table,
    columns,
    schema,
    runner,
    migration: new DiscussionParticipation1791676824000(),
  };
}
describe('canonical participation migration', () => {
  it('validates ordered SQL index metadata on reentry without DDL', async () => {
    const { runner, migration } = fixture();
    await migration.up(runner as unknown as QueryRunner);
    expect(runner.createIndex).not.toHaveBeenCalled();
  });
  it('adds an absent index on first application and validates it', async () => {
    const { table, runner, migration } = fixture();
    table.indices = [];
    await migration.up(runner as unknown as QueryRunner);
    expect(runner.createIndex).toHaveBeenCalledWith(
      'discussion_write_nodes',
      expect.objectContaining({
        columnNames: ['ownerIdentityId', 'discussionId', 'nodeId'],
      })
    );
  });
  it.each(['sequence', 'prefix', 'unique', 'missing'] as const)(
    'rejects incompatible index %s',
    async (failure) => {
      const { columns, runner, migration } = fixture();
      if (failure === 'sequence') columns.reverse();
      if (failure === 'prefix') columns[0].prefixLength = 8;
      if (failure === 'unique') columns[0].nonUnique = 0;
      if (failure === 'missing') columns.pop();
      await expect(
        migration.up(runner as unknown as QueryRunner)
      ).rejects.toThrow('Incompatible discussion participant index');
    }
  );
  it('rejects case insensitive or nontransactional authority before creating an index', async () => {
    const { schema, runner, migration } = fixture();
    schema[0].COLLATION_NAME = 'utf8mb4_general_ci';
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('binary transactional ownership');
    schema[0].COLLATION_NAME = 'utf8mb4_bin';
    schema[0].ENGINE = 'MyISAM';
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('binary transactional ownership');
    expect(runner.createIndex).not.toHaveBeenCalled();
  });
  it('refuses lost completed indexes and automatic down migration', async () => {
    const { table, runner, migration } = fixture();
    table.indices = [];
    runner.hasTable.mockResolvedValue(true);
    const original = runner.query.getMockImplementation();
    runner.query.mockImplementation(async (sql) =>
      sql.includes('FROM migrations') ? [{ id: 1 }] : original!(sql)
    );
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('Completed discussion participant index is missing');
    await expect(migration.down()).rejects.toThrow(
      'reviewed forward migration'
    );
    expect(runner.createIndex).not.toHaveBeenCalled();
  });
});
