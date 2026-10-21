import type { QueryRunner, Table, TableColumnOptions } from 'typeorm';
import { editorialAuthorErasureApplied } from '../account-erasure/editorial-erasure-schema';

export class EditorialSchemaCompatibilityError extends Error {}

/** MySQL index order comes from SEQ_IN_INDEX, not ORM column enumeration. */
export async function assertEditorialMigrationIndexes(
  runner: QueryRunner,
  table: Table
): Promise<void> {
  for (const index of table.indices) {
    const rows: Record<string, unknown>[] = await runner.query(
      'SELECT COLUMN_NAME AS name,SUB_PART AS prefix,NON_UNIQUE AS nonUnique,COLLATION AS direction,IS_VISIBLE AS visible,EXPRESSION AS expression FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX',
      [table.name, index.name]
    );
    if (
      rows.length !== index.columnNames.length ||
      rows.some(
        (row, i) =>
          row.name !== index.columnNames[i] ||
          row.prefix !== null ||
          Number(row.nonUnique) !== (index.isUnique ? 0 : 1) ||
          row.direction !== 'A' ||
          row.visible !== 'YES' ||
          row.expression !== null
      )
    )
      throw new EditorialSchemaCompatibilityError(
        `Incompatible Editorial migration index: ${table.name}.${index.name}`
      );
  }
}

type Column = TableColumnOptions;
interface Schema {
  columns: Column[];
  primary: string[];
  unique?: string[][];
  references?: [string, string][];
}

const varchar = (name: string, length: number, isNullable = false): Column => ({
  name,
  type: 'varchar',
  length: String(length),
  isNullable,
});
const bigint = (
  name: string,
  isNullable = false,
  unsigned = false
): Column => ({
  name,
  type: 'bigint',
  isNullable,
  unsigned,
});
const tinyint = (name: string, defaultValue?: string): Column => ({
  name,
  type: 'tinyint',
  isNullable: false,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
});
const timestamps: Column[] = ['createdAt', 'updatedAt'].map((name) => ({
  name,
  type: 'datetime',
  isNullable: false,
}));
const resource: Column[] = [
  varchar('id', 36),
  varchar('name', 255),
  varchar('slug', 255),
];
const scope: Column[] = [
  varchar('resourceKind', 16),
  varchar('resourceId', 36),
];
const identity = [
  varchar('tenantId', 128),
  varchar('actorIdentityId', 128),
  varchar('commandKey', 128),
];

const schemas: Record<string, Schema> = {
  categories: {
    columns: [...resource, varchar('parentId', 36, true), ...timestamps],
    primary: ['id'],
    unique: [['slug']],
    references: [['parentId', 'categories']],
  },
  tags: {
    columns: [...resource, ...timestamps],
    primary: ['id'],
    unique: [['slug']],
  },
  app_records: {
    columns: [
      ...resource,
      { name: 'description', type: 'text', isNullable: true },
      varchar('website', 500, true),
      tinyint('isPwa', '0'),
      {
        name: 'rating',
        type: 'decimal',
        precision: 2,
        scale: 1,
        isNullable: true,
      },
      {
        name: 'estimatedNumberOfUsers',
        type: 'int',
        isNullable: true,
        unsigned: false,
      },
      tinyint('isSuspended', '0'),
      varchar('logoUrl', 255, true),
      varchar('bannerUrl', 255, true),
      varchar('categoryId', 36, true),
      ...timestamps,
    ],
    primary: ['id'],
    unique: [['slug']],
    references: [['categoryId', 'categories']],
  },
  editorial_resource_states: {
    columns: [
      ...scope,
      varchar('tenantId', 128),
      varchar('ownerIdentityId', 128),
      bigint('revision', false, true),
      bigint('deletedAt', true),
    ],
    primary: ['resourceKind', 'resourceId'],
  },
  editorial_backfills: {
    columns: [
      ...scope,
      ...['manifestFingerprint', 'sourceFingerprint', 'fingerprint'].map(
        (name) => ({
          name,
          type: 'char' as const,
          length: '64',
          isNullable: false,
        })
      ),
      bigint('revision', false, true),
      bigint('committedAt'),
    ],
    primary: ['resourceKind', 'resourceId'],
  },
  editorial_commands: {
    columns: [
      ...identity,
      { name: 'fingerprint', type: 'char', length: '64', isNullable: false },
      ...scope,
      bigint('revision', false, true),
      tinyint('deleted'),
      bigint('createdAt'),
    ],
    primary: ['tenantId', 'actorIdentityId', 'commandKey'],
  },
  editorial_outbox: {
    columns: [
      {
        ...bigint('id', false, true),
        isGenerated: true,
        generationStrategy: 'increment',
      },
      ...scope,
      varchar('tenantId', 128),
      bigint('revision', false, true),
      varchar('operation', 16),
      varchar('actorIdentityId', 128),
      bigint('createdAt'),
      bigint('availableAt'),
      {
        name: 'attempts',
        type: 'int',
        unsigned: true,
        isNullable: false,
        default: '0',
      },
      varchar('leaseToken', 36, true),
      bigint('leasedUntil', true),
      bigint('deliveredAt', true),
      bigint('failedAt', true),
      varchar('lastError', 512, true),
    ],
    primary: ['id'],
    unique: [['resourceKind', 'resourceId', 'revision']],
  },
};
for (const name of [
  'platforms',
  'devices',
  'socials',
  'stores',
  'monetization_models',
  'user_spans',
]) {
  schemas[name] = {
    columns: resource,
    primary: ['id'],
    unique: [['name'], ['slug']],
  };
}
for (const [name, column, target] of [
  ['app_record_tags', 'tagsId', 'tags'],
  ['app_record_platforms', 'platformsId', 'platforms'],
  ['app_record_devices', 'devicesId', 'devices'],
  ['app_record_monetization', 'monetizationModelsId', 'monetization_models'],
]) {
  schemas[name] = {
    columns: [varchar('appRecordsId', 36), varchar(column, 36)],
    primary: ['appRecordsId', column],
    references: [
      ['appRecordsId', 'app_records'],
      [column, target],
    ],
  };
}

function sameColumns(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function assertTable(table: Table, expected: Schema, name: string): void {
  const fail = (detail: string): never => {
    throw new EditorialSchemaCompatibilityError(
      `Incompatible Editorial schema ${name}.${detail}; an explicit legacy migration is required`
    );
  };
  for (const column of expected.columns) {
    const actual = table.columns.find((value) => value.name === column.name);
    if (!actual) fail(column.name);
    for (const key of [
      'type',
      'length',
      'isNullable',
      'unsigned',
      'precision',
      'scale',
      'isGenerated',
      'generationStrategy',
    ] as const) {
      // Both widths are explicit migration states; publication widens the legacy column without truncation.
      if (
        name === 'app_records' &&
        column.name === 'website' &&
        key === 'length' &&
        ['500', '2048'].includes(actual?.length ?? '')
      )
        continue;
      if (column[key] !== undefined && actual?.[key] !== column[key])
        fail(column.name);
    }
    if (
      column.default !== undefined &&
      String(actual?.default).replace(/^'(.*)'$/, '$1') !== column.default
    )
      fail(`${column.name} default`);
    if (
      name.startsWith('editorial_') &&
      ['char', 'varchar'].includes(column.type) &&
      actual?.collation !== 'utf8mb4_bin'
    )
      fail(`${column.name} case-sensitive collation`);
  }
  if (
    !sameColumns(
      table.primaryColumns.map((column) => column.name),
      expected.primary
    )
  )
    fail('primary key');
  for (const columns of expected.unique ?? []) {
    if (
      !(
        table.indices.some(
          (index) => index.isUnique && sameColumns(index.columnNames, columns)
        ) ||
        table.uniques.some((unique) =>
          sameColumns(unique.columnNames, columns)
        ) ||
        (columns.length === 1 &&
          table.columns.some(
            (column) => column.name === columns[0] && column.isUnique
          ))
      )
    )
      fail(`unique ${columns.join(',')}`);
  }
  for (const [column, target] of expected.references ?? []) {
    if (
      !table.foreignKeys.some(
        (key) =>
          key.columnNames.length === 1 &&
          key.columnNames[0] === column &&
          key.referencedTableName === target &&
          key.referencedColumnNames.length === 1 &&
          key.referencedColumnNames[0] === 'id'
      )
    )
      fail(`foreign key ${column}`);
  }
  for (const column of table.columns) {
    if (
      !expected.columns.some((value) => value.name === column.name) &&
      !column.isNullable &&
      column.default == null &&
      !column.isGenerated
    )
      fail(`unsupported required column ${column.name}`);
  }
}

/** Refuse incompatible pre-existing tables before MySQL executes any non-transactional DDL. */
export async function assertEditorialSchema(
  runner: QueryRunner
): Promise<void> {
  const names = Object.keys(schemas);
  const existing: { tableName: string; engine: string | null }[] =
    await runner.query(
      `SELECT TABLE_NAME AS tableName, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${names
        .map(() => '?')
        .join(', ')})`,
      names
    );
  for (const entry of existing) {
    if (entry.engine?.toLowerCase() !== 'innodb')
      throw new EditorialSchemaCompatibilityError(
        `Editorial requires transactional InnoDB tables; review ${entry.tableName} before migration`
      );
    const table = await runner.getTable(entry.tableName);
    if (!table)
      throw new EditorialSchemaCompatibilityError(
        `Missing Editorial schema metadata: ${entry.tableName}`
      );
    // TypeORM omits default lengths/collations when no entity metadata is loaded.
    // Maintenance runs must inspect the stored schema rather than infer defaults.
    const columns: {
      columnName: string;
      maximumLength: number | string | null;
      collationName: string | null;
    }[] = await runner.query(
      'SELECT COLUMN_NAME AS columnName, CHARACTER_MAXIMUM_LENGTH AS maximumLength, COLLATION_NAME AS collationName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [entry.tableName]
    );
    const physical = new Map(
      columns.map((column) => [column.columnName, column])
    );
    const stored = table.clone();
    for (const column of stored.columns) {
      if (!['char', 'varchar'].includes(column.type)) continue;
      const metadata = physical.get(column.name);
      if (
        !metadata ||
        metadata.maximumLength === null ||
        !metadata.collationName
      )
        throw new EditorialSchemaCompatibilityError(
          `Missing Editorial column metadata: ${entry.tableName}.${column.name}`
        );
      column.length = String(metadata.maximumLength);
      column.collation = metadata.collationName;
    }
    const expected = schemas[entry.tableName];
    const identityColumn =
      entry.tableName === 'editorial_resource_states'
        ? 'ownerIdentityId'
        : entry.tableName === 'editorial_outbox'
        ? 'actorIdentityId'
        : null;
    const anonymous =
      identityColumn &&
      stored.findColumnByName(identityColumn)?.isNullable &&
      (await editorialAuthorErasureApplied(runner));
    assertTable(
      stored,
      anonymous
        ? {
            ...expected,
            columns: expected.columns.map((column) =>
              column.name === identityColumn
                ? { ...column, isNullable: true }
                : column
            ),
          }
        : expected,
      entry.tableName
    );
  }
}
