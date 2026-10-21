import type { QueryRunner } from 'typeorm';
import { Table } from 'typeorm';
import { EditorialOwnership1791676802000 } from './editorial-schema.migration';
import { EditorialBackfill1791676803000 } from './editorial-backfill.migration';

describe('Editorial migration safeguards', () => {
  const migration = new EditorialOwnership1791676802000();
  it('creates the write schema without assigning ownership to existing content', async () => {
    const query = jest.fn().mockResolvedValue([]);
    await migration.up({ query } as unknown as QueryRunner);
    const statements = query.mock.calls.map(([sql]) => sql as string);
    expect(
      statements.filter((sql) => sql.startsWith('CREATE TABLE'))
    ).toHaveLength(16);
    expect(
      statements.some((sql) => /^(INSERT|UPDATE|DELETE|ALTER|DROP)/.test(sql))
    ).toBe(false);
    expect(
      statements.some(
        (sql) =>
          sql.includes('editorial_outbox') &&
          sql.includes('UNIQUE KEY uq_editorial_outbox_revision')
      )
    ).toBe(true);
  });
  it('refuses non-transactional legacy tables before any DDL', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ tableName: 'app_records', engine: 'MyISAM' }]);
    await expect(
      migration.up({ query } as unknown as QueryRunner)
    ).rejects.toThrow('InnoDB');
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('refuses a legacy numeric identity instead of pretending it is a UUID schema', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ tableName: 'app_records', engine: 'InnoDB' }]);
    const getTable = jest.fn().mockResolvedValue(
      new Table({
        name: 'app_records',
        columns: [{ name: 'id', type: 'int', isPrimary: true }],
      })
    );
    await expect(
      migration.up({ query, getTable } as unknown as QueryRunner)
    ).rejects.toThrow('explicit legacy migration');
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('does not offer a destructive automatic rollback', async () => {
    await expect(migration.down()).rejects.toThrow('authoritative');
  });

  it('installs the separate backfill receipt migration without inferring any owners', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const backfill = new EditorialBackfill1791676803000();
    await backfill.up({ query } as unknown as QueryRunner);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain(
      'CREATE TABLE IF NOT EXISTS editorial_backfills'
    );
    expect(query.mock.calls[1][0]).toContain('COLLATE=utf8mb4_bin');
    await expect(backfill.down()).rejects.toThrow('authoritative');
  });

  it('refuses a partial receipt table before running the backfill migration', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([
        { tableName: 'editorial_backfills', engine: 'InnoDB' },
      ]);
    const getTable = jest
      .fn()
      .mockResolvedValue(
        new Table({ name: 'editorial_backfills', columns: [] })
      );
    await expect(
      new EditorialBackfill1791676803000().up({
        query,
        getTable,
      } as unknown as QueryRunner)
    ).rejects.toThrow('editorial_backfills');
    expect(query).toHaveBeenCalledTimes(2);
  });

  function legacyTag() {
    return new Table({
      name: 'tags',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'name', type: 'varchar', length: '255' },
        { name: 'slug', type: 'varchar', length: '255', isUnique: true },
        { name: 'createdAt', type: 'datetime' },
        { name: 'updatedAt', type: 'datetime' },
      ],
    });
  }

  function existing(table: Table, physical = table) {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ tableName: table.name, engine: 'InnoDB' }])
      .mockResolvedValueOnce(
        physical.columns.map((column) => ({
          columnName: column.name,
          maximumLength: column.length || null,
          collationName: column.collation || 'utf8mb4_0900_ai_ci',
        }))
      );
    const getTable = jest.fn().mockResolvedValue(table);
    return { query, getTable };
  }

  it('accepts a compatible legacy table without changing it', async () => {
    const runner = existing(legacyTag());
    await migration.up(runner as unknown as QueryRunner);
    expect(runner.query).toHaveBeenCalledTimes(18);
    expect(
      runner.query.mock.calls.every(([sql]) =>
        /^(SELECT|CREATE TABLE IF NOT EXISTS)/.test(sql)
      )
    ).toBe(true);
  });

  it('uses physical lengths when a maintenance connection has no entity metadata', async () => {
    const physical = legacyTag();
    const normalized = physical.clone();
    normalized.columns[1].length = '';
    normalized.columns[2].length = '';
    const runner = existing(normalized, physical);
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).resolves.toBeUndefined();
  });

  it('does not accept an incorrect physical length hidden by ORM metadata', async () => {
    const normalized = legacyTag();
    const physical = normalized.clone();
    physical.columns[1].length = '200';
    const runner = existing(normalized, physical);
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('tags.name');
    expect(runner.query).toHaveBeenCalledTimes(2);
  });

  it.each([
    'missing timestamp',
    'nullable name',
    'no slug uniqueness',
    'extra required field',
  ])('refuses incompatible legacy resources: %s', async (reason) => {
    const table = legacyTag();
    if (reason === 'missing timestamp') table.removeColumn(table.columns[3]);
    if (reason === 'nullable name') table.columns[1].isNullable = true;
    if (reason === 'no slug uniqueness') table.columns[2].isUnique = false;
    if (reason === 'extra required field') {
      const extra = table.columns[1].clone();
      extra.name = 'unrecognized';
      table.addColumn(extra);
    }
    const runner = existing(table);
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('explicit legacy migration');
    expect(runner.query).toHaveBeenCalledTimes(2);
  });

  it('refuses partially created ownership tables before continuing DDL', async () => {
    const runner = existing(
      new Table({ name: 'editorial_resource_states', columns: [] })
    );
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('editorial_resource_states');
    expect(runner.query).toHaveBeenCalledTimes(2);
  });

  it('refuses case-insensitive authoritative scope comparisons', async () => {
    const runner = existing(
      new Table({
        name: 'editorial_resource_states',
        columns: [
          {
            name: 'resourceKind',
            type: 'varchar',
            length: '16',
            collation: 'utf8mb4_general_ci',
          },
        ],
      })
    );
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('case-sensitive collation');
    expect(runner.query).toHaveBeenCalledTimes(2);
  });

  it('requires the relation foreign keys that prevent dangling references', async () => {
    const table = legacyTag();
    table.name = 'categories';
    const parent = table.columns[0].clone();
    parent.name = 'parentId';
    parent.isPrimary = false;
    parent.isNullable = true;
    table.addColumn(parent);
    const runner = existing(table);
    await expect(
      migration.up(runner as unknown as QueryRunner)
    ).rejects.toThrow('foreign key parentId');
    expect(runner.query).toHaveBeenCalledTimes(2);
  });
});
