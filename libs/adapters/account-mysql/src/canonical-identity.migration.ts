import type { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { canonicalIdentityState } from './mysql-canonical-identities';

export class CanonicalIdentityMigrationError extends Error {}

function requireSchema(condition: unknown, detail: string): asserts condition {
  if (!condition)
    throw new CanonicalIdentityMigrationError(
      `Canonical identity migration refused: ${detail}; review legacy data before cutover`
    );
}

type Field = [
  name: string,
  type: string,
  length?: number,
  nullable?: boolean,
  unsigned?: boolean,
  defaultValue?: string
];

function unique(table: Table, names: string[]): boolean {
  const same = (columns: string[]) =>
    columns.length === names.length &&
    names.every((name) => columns.includes(name));
  return (
    table.indices.some((index) => index.isUnique && same(index.columnNames)) ||
    table.uniques.some((index) => same(index.columnNames)) ||
    (names.length === 1 &&
      table.columns.some(
        (column) => column.name === names[0] && column.isUnique
      ))
  );
}

export class CanonicalIdentity1791676804000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const tables: { tableName: string; engine: string }[] = await runner.query(
      "SELECT TABLE_NAME AS tableName, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('identities', 'identity_subjects', 'identity_events_outbox', 'identity_deletion_jobs', 'identity_accounts', 'identity_account_commands')"
    );
    requireSchema(
      tables.some((table) => table.tableName === 'identities'),
      'the base identity migration is missing'
    );
    for (const table of tables)
      requireSchema(
        table.engine.toLowerCase() === 'innodb',
        `non-transactional ${table.tableName}`
      );
    if (tables.some((table) => table.tableName === 'identity_subjects')) {
      const legacy: unknown[] = await runner.query(
        'SELECT 1 FROM identity_subjects LIMIT 1'
      );
      requireSchema(
        legacy.length === 0,
        'legacy subject mappings need a verified identity/account migration'
      );
    }
    const table = await runner.getTable('identities');
    requireSchema(table, 'identity schema metadata is missing');
    const expected: [string, string[], number?][] = [
      ['id', ['varchar'], 36],
      ['identity_id', ['varchar'], 255],
      ['claim', ['varchar'], 255],
      ['kind', ['varchar'], 64],
      ['provider_type', ['varchar'], 64],
      ['provider_secret', ['varchar'], 255],
      ['is_active', ['boolean', 'tinyint']],
      ['is_suspended', ['boolean', 'tinyint']],
      ['is_deleted', ['boolean', 'tinyint']],
      ['created_at', ['bigint']],
      ['updated_at', ['bigint']],
      ['deleted_at', ['bigint']],
    ];
    for (const [name, types, length] of expected) {
      const column = table.columns.find((item) => item.name === name);
      requireSchema(
        column &&
          types.includes(column.type) &&
          (length === undefined || column.length === String(length)) &&
          column.isNullable === (name === 'provider_secret'),
        `incompatible identities.${name}`
      );
    }
    requireSchema(
      table.primaryColumns.length === 1 &&
        table.primaryColumns[0].name === 'id' &&
        unique(table, ['claim']),
      'identity keys differ from the canonical contract'
    );
    for (const column of table.columns)
      requireSchema(
        expected.some(([name]) => name === column.name) ||
          column.name === 'revision' ||
          column.isNullable ||
          column.default != null ||
          column.isGenerated,
        `unsupported required column ${column.name}`
      );
    const revision = table.columns.find((column) => column.name === 'revision');
    if (revision)
      requireSchema(
        revision.type === 'bigint' &&
          revision.unsigned &&
          !revision.isNullable &&
          String(revision.default).replace(/'/g, '') === '1',
        'incompatible revision column'
      );
    const invalid: unknown[] =
      await runner.query(`SELECT id FROM identities WHERE
      BINARY identity_id <> BINARY claim OR CHAR_LENGTH(claim) < 1 OR CHAR_LENGTH(claim) > 128
      OR BINARY TRIM(claim) <> BINARY claim OR claim REGEXP '[[:cntrl:]]'
      OR is_active NOT IN (0, 1) OR is_suspended NOT IN (0, 1) OR is_deleted NOT IN (0, 1)
      OR created_at <= 0 OR updated_at < created_at OR updated_at > 8640000000000000 OR deleted_at < 0 OR deleted_at > updated_at
      OR CHAR_LENGTH(id) <> 36 OR kind NOT IN ('user', 'guest') OR provider_type NOT REGEXP '^[a-z][a-z0-9_-]{0,63}$'
      OR (is_deleted = 0 AND deleted_at <> 0)
      OR (is_deleted = 1 AND (deleted_at = 0 OR is_active = 1))
      ${
        revision ? 'OR revision < 1 OR revision > 9007199254740991' : ''
      } LIMIT 1`);
    requireSchema(
      invalid.length === 0,
      'invalid canonical identifiers or lifecycle data'
    );
    let after: string | null = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        `SELECT id, identity_id, claim, kind, provider_type, is_active, is_suspended, is_deleted, created_at, updated_at, deleted_at, ${
          revision ? 'revision' : '1 AS revision'
        } FROM identities WHERE (? IS NULL OR BINARY id > BINARY ?) ORDER BY BINARY id LIMIT 256`,
        [after, after]
      );
      for (const row of rows) {
        try {
          canonicalIdentityState(row);
        } catch {
          requireSchema(false, 'invalid stored canonical identity');
        }
      }
      if (rows.length < 256) break;
      after = String(rows[rows.length - 1].id);
    }
    const collations: {
      tableName: string;
      columnName: string;
      collation: string | null;
    }[] = await runner.query(
      "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('identity_events_outbox', 'identity_deletion_jobs', 'identity_accounts', 'identity_account_commands')"
    );
    const journals: [string, string[], Field[], string[]?][] = [
      [
        'identity_events_outbox',
        ['id'],
        [
          ['id', 'varchar', 36],
          ['identityId', 'varchar', 128],
          ['eventType', 'varchar', 64],
          ['revision', 'bigint', undefined, false, true],
          ['body', 'text'],
          ['createdAt', 'bigint'],
          ['availableAt', 'bigint'],
          ['attempts', 'int', undefined, false, true, '0'],
          ['leaseToken', 'varchar', 36, true],
          ['leasedUntil', 'bigint', undefined, true],
          ['deliveredAt', 'bigint', undefined, true],
          ['failedAt', 'bigint', undefined, true],
        ],
        ['deliveredAt', 'failedAt', 'availableAt', 'leasedUntil'],
      ],
      [
        'identity_deletion_jobs',
        ['identityId'],
        [
          ['identityId', 'varchar', 128],
          ['revision', 'bigint', undefined, false, true],
          ['createdAt', 'bigint'],
          ['availableAt', 'bigint'],
          ['attempts', 'int', undefined, false, true, '0'],
          ['leaseToken', 'varchar', 36, true],
          ['leasedUntil', 'bigint', undefined, true],
          ['completedAt', 'bigint', undefined, true],
          ['failedAt', 'bigint', undefined, true],
        ],
        ['completedAt', 'failedAt', 'availableAt', 'leasedUntil'],
      ],
      [
        'identity_accounts',
        ['identityId'],
        [
          ['identityId', 'varchar', 128],
          ['name', 'varchar', 120],
          ['bio', 'varchar', 500, true],
          ['location', 'varchar', 120, true],
          ['avatarUri', 'varchar', 2048, true],
          ['registeredAt', 'bigint'],
          ['updatedAt', 'bigint'],
        ],
      ],
      [
        'identity_account_commands',
        ['identityId', 'commandKey'],
        [
          ['identityId', 'varchar', 128],
          ['commandKey', 'varchar', 128],
          ['fingerprint', 'char', 64],
          ['revision', 'bigint', undefined, false, true],
          ['createdAt', 'bigint'],
        ],
      ],
    ];
    for (const [name, primary, fields, pending] of journals) {
      const existing = await runner.getTable(name);
      if (!existing) continue;
      // TypeORM's metadata query does not order columns; uniqueness depends on the key's members.
      const keyMatches = (names: string[]) =>
        names.length === primary.length &&
        primary.every((field) => names.includes(field));
      requireSchema(
        keyMatches(existing.primaryColumns.map((column) => column.name)),
        `incompatible ${name} primary key`
      );
      requireSchema(
        existing.foreignKeys.length === 0 && existing.checks.length === 0,
        `unexpected ${name} constraints`
      );
      requireSchema(
        existing.uniques.every((key) => keyMatches(key.columnNames)) &&
          existing.indices.every(
            (index) => !index.isUnique || keyMatches(index.columnNames)
          ),
        `unexpected ${name} unique key`
      );
      for (const [
        field,
        type,
        length,
        nullable = false,
        unsigned = false,
        defaultValue,
      ] of fields) {
        const column = existing.columns.find((item) => item.name === field);
        const collation = collations.find(
          (item) => item.tableName === name && item.columnName === field
        )?.collation;
        requireSchema(
          column &&
            column.type === type &&
            column.isNullable === nullable &&
            (!length || column.length === String(length)) &&
            !column.isGenerated &&
            !column.asExpression,
          `incompatible ${name}.${field}`
        );
        if (['varchar', 'char', 'text'].includes(type))
          requireSchema(
            collation === 'utf8mb4_bin',
            `unsafe ${name}.${field} collation`
          );
        if (['int', 'bigint'].includes(type))
          requireSchema(
            column.unsigned === unsigned,
            `incompatible ${name}.${field} integer range`
          );
        if (defaultValue !== undefined)
          requireSchema(
            String(column.default).replace(/'/g, '') === defaultValue,
            `incompatible ${name}.${field} default`
          );
        if (column.isUnique)
          requireSchema(
            primary.length === 1 && primary[0] === field,
            `unexpected ${name}.${field} uniqueness`
          );
      }
      for (const column of existing.columns)
        requireSchema(
          fields.some(([field]) => field === column.name) ||
            column.isNullable ||
            column.default != null ||
            column.isGenerated,
          `unsupported required ${name}.${column.name}`
        );
      if (pending)
        requireSchema(
          existing.indices.some(
            (index) =>
              !index.isUnique &&
              index.columnNames.join(',') === pending.join(',')
          ),
          `missing ${name} pending index`
        );
    }
    const triggers: unknown[] = await runner.query(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE IN ('identities', 'identity_events_outbox', 'identity_deletion_jobs', 'identity_accounts', 'identity_account_commands') LIMIT 1"
    );
    requireSchema(triggers.length === 0, 'unreviewed identity triggers');
    // DDL can commit independently in MySQL. All existing data/schema checks precede it.
    await runner.query(`ALTER TABLE identities
      MODIFY claim varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      MODIFY identity_id varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL
      ${
        revision
          ? ''
          : ', ADD COLUMN revision bigint unsigned NOT NULL DEFAULT 1'
      }
      ${
        unique(table, ['identity_id'])
          ? ''
          : ', ADD UNIQUE KEY uq_canonical_identity_id (identity_id)'
      }`);
    await runner.query(`CREATE TABLE IF NOT EXISTS identity_events_outbox (
      id varchar(36) NOT NULL PRIMARY KEY, identityId varchar(128) NOT NULL, eventType varchar(64) NOT NULL,
      revision bigint unsigned NOT NULL, body text NOT NULL, createdAt bigint NOT NULL, availableAt bigint NOT NULL,
      attempts int unsigned NOT NULL DEFAULT 0, leaseToken varchar(36) NULL, leasedUntil bigint NULL,
      deliveredAt bigint NULL, failedAt bigint NULL,
      INDEX idx_identity_events_pending (deliveredAt, failedAt, availableAt, leasedUntil)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    await runner.query(`CREATE TABLE IF NOT EXISTS identity_deletion_jobs (
      identityId varchar(128) NOT NULL PRIMARY KEY, revision bigint unsigned NOT NULL,
      createdAt bigint NOT NULL, availableAt bigint NOT NULL, attempts int unsigned NOT NULL DEFAULT 0,
      leaseToken varchar(36) NULL, leasedUntil bigint NULL, completedAt bigint NULL, failedAt bigint NULL,
      INDEX idx_identity_deletion_pending (completedAt, failedAt, availableAt, leasedUntil)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    await runner.query(`CREATE TABLE IF NOT EXISTS identity_accounts (
      identityId varchar(128) NOT NULL PRIMARY KEY, name varchar(120) NOT NULL, bio varchar(500) NULL,
      location varchar(120) NULL, avatarUri varchar(2048) NULL, registeredAt bigint NOT NULL, updatedAt bigint NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    await runner.query(`CREATE TABLE IF NOT EXISTS identity_account_commands (
      identityId varchar(128) NOT NULL, commandKey varchar(128) NOT NULL, fingerprint char(64) NOT NULL,
      revision bigint unsigned NOT NULL, createdAt bigint NOT NULL, PRIMARY KEY (identityId, commandKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Canonical identity and event history are authoritative; use a reviewed forward migration'
    );
  }
}
