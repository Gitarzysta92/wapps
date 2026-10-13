import { includeClassificationColumn } from '../content-classification/content-classification-schema';
import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';

export class SuiteWorkspace1791676808000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    const scope = [
      { name: 'tenantId', type: 'varchar', length: '128', isPrimary: true },
      {
        name: 'ownerIdentityId',
        type: 'varchar',
        length: '128',
        isPrimary: true,
      },
    ];
    const tables = [
      new Table({ name: 'suite_workspaces', columns: scope }),
      new Table({
        name: 'private_suites',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          ...scope.map((column) => ({ ...column, isPrimary: false })),
          { name: 'title', type: 'varchar', length: '100' },
          { name: 'description', type: 'text' },
          { name: 'applicationIds', type: 'json' },
          { name: 'revision', type: 'bigint', unsigned: true },
          { name: 'createdAt', type: 'bigint', unsigned: true },
          { name: 'updatedAt', type: 'bigint', unsigned: true },
          {
            name: 'deletedAt',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'idx_private_suite_owner',
            columnNames: [
              'tenantId',
              'ownerIdentityId',
              'deletedAt',
              'updatedAt',
            ],
          },
        ],
      }),
      new Table({
        name: 'suite_commands',
        columns: [
          ...scope,
          {
            name: 'commandKey',
            type: 'varchar',
            length: '128',
            isPrimary: true,
          },
          { name: 'fingerprint', type: 'char', length: '64' },
          { name: 'suiteId', type: 'varchar', length: '36' },
          { name: 'revision', type: 'bigint', unsigned: true },
          { name: 'deleted', type: 'tinyint' },
          { name: 'createdAt', type: 'bigint', unsigned: true },
        ],
      }),
    ];
    for (const table of tables) {
      table.engine = 'InnoDB';
      for (const column of table.columns) {
        if (['varchar', 'char', 'text'].includes(column.type)) {
          column.charset = 'utf8mb4';
          column.collation = 'utf8mb4_bin';
        }
      }
      if (!(await runner.hasTable(table.name))) await runner.createTable(table);
      const [storage] = await runner.query(
        'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table.name]
      );
      if (storage?.engine !== 'InnoDB')
        throw new Error(`Suite storage must be transactional: ${table.name}`);
      const actual = await runner.getTable(table.name);
      includeClassificationColumn(table, actual);
      // TypeORM omits charset/collation when they equal the database defaults.
      const physical: { name: string; collation: string | null }[] =
        await runner.query(
          'SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
          [table.name]
        );
      if (
        !actual ||
        actual.columns.length !== table.columns.length ||
        table.columns.some((expected) => {
          const column = actual.columns.find(
            (item) => item.name === expected.name
          );
          return (
            !column ||
            column.type !== expected.type ||
            column.length !== expected.length ||
            column.isNullable !== expected.isNullable ||
            column.isPrimary !== expected.isPrimary ||
            column.unsigned !== expected.unsigned ||
            (expected.collation &&
              physical.find((item) => item.name === expected.name)
                ?.collation !== expected.collation)
          );
        })
      )
        throw new Error(`Incompatible suite schema: ${table.name}`);
      const keys = await runner.query(
        "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",
        [table.name]
      );
      if (
        JSON.stringify(keys.map((row: { name: string }) => row.name)) !==
        JSON.stringify(table.primaryColumns.map((column) => column.name))
      )
        throw new Error(`Incompatible suite primary key: ${table.name}`);
    }
    const invalid =
      await runner.query(`SELECT id FROM private_suites WHERE revision < 1 OR updatedAt < createdAt OR JSON_TYPE(applicationIds) <> 'ARRAY'
      OR (deletedAt IS NULL AND (CHAR_LENGTH(TRIM(title)) < 1 OR CHAR_LENGTH(description) > 1000 OR JSON_LENGTH(applicationIds) NOT BETWEEN 1 AND 50))
      OR (deletedAt IS NOT NULL AND (title <> '' OR description <> '' OR JSON_LENGTH(applicationIds) <> 0)) LIMIT 1`);
    if (invalid.length)
      throw new Error(
        'Invalid canonical suite rows; repair explicitly before migration'
      );
    const capacity = await runner.query(
      'SELECT tenantId FROM private_suites WHERE deletedAt IS NULL GROUP BY tenantId, ownerIdentityId HAVING COUNT(*) > 100 LIMIT 1'
    );
    const orphan = await runner.query(
      'SELECT s.id FROM private_suites s LEFT JOIN suite_workspaces w ON w.tenantId = s.tenantId AND w.ownerIdentityId = s.ownerIdentityId WHERE w.ownerIdentityId IS NULL LIMIT 1'
    );
    const receipts = await runner.query(
      'SELECT c.suiteId FROM suite_commands c LEFT JOIN private_suites s ON s.id = c.suiteId AND s.tenantId = c.tenantId AND s.ownerIdentityId = c.ownerIdentityId WHERE s.id IS NULL OR c.revision < 1 OR c.revision > s.revision OR c.deleted NOT IN (0,1) LIMIT 1'
    );
    if (capacity.length || orphan.length || receipts.length)
      throw new Error(
        'Invalid suite capacity, ownership or receipt relationships'
      );
  }
  async down(): Promise<void> {
    throw new Error(
      'Suites and receipts are authoritative; use a reviewed data-preserving migration'
    );
  }
}
