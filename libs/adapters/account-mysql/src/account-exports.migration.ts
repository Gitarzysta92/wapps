import { createHash } from 'node:crypto';
import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  ACCOUNT_EXPORT_LIMITS,
  accountExportId,
} from '@sdk/features/identity/core';
import { canonicalSqlInteger } from './canonical-account-sql';
import {
  accountExportDigest,
  accountExportFromSql,
  type AccountExportRow,
} from './account-export-sql';

const schemas = [
  {
    name: 'identity_account_exports',
    columns: [
      ['id', 'char', '36', false],
      ['identityId', 'varchar', '128', false],
      ['commandKey', 'varchar', '128', false],
      ['status', 'varchar', '16', false],
      ['requestedAt', 'bigint', '', false],
      ['expiresAt', 'bigint', '', false],
      ['availableAt', 'bigint', '', false],
      ['attempts', 'int', '', false],
      ['leaseToken', 'char', '36', true],
      ['leasedUntil', 'bigint', '', true],
      ['readyAt', 'bigint', '', true],
      ['artifact', 'json', '', true],
      ['failure', 'varchar', '32', true],
    ],
    indexes: {
      PRIMARY: ['id', 0],
      export_command: ['identityId,commandKey', 0],
      export_owner: ['identityId,requestedAt,id', 1],
      export_work: ['status,availableAt,id', 1],
      export_expiry: ['expiresAt,id', 1],
    },
    sql: `CREATE TABLE identity_account_exports (
      id char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      commandKey varchar(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      status varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      requestedAt bigint UNSIGNED NOT NULL, expiresAt bigint UNSIGNED NOT NULL,
      availableAt bigint UNSIGNED NOT NULL, attempts int UNSIGNED NOT NULL,
      leaseToken char(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
      leasedUntil bigint UNSIGNED NULL, readyAt bigint UNSIGNED NULL,
      artifact json NULL, failure varchar(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
      PRIMARY KEY (id), UNIQUE KEY export_command (identityId, commandKey),
      KEY export_owner (identityId, requestedAt, id), KEY export_work (status, availableAt, id),
      KEY export_expiry (expiresAt, id)
    ) ENGINE=InnoDB`,
  },
  {
    name: 'identity_account_export_chunks',
    columns: [
      ['exportId', 'char', '36', false],
      ['attemptId', 'char', '36', false],
      ['position', 'int', '', false],
      ['payload', 'mediumblob', '', false],
      ['sha256', 'char', '64', false],
    ],
    indexes: {
      PRIMARY: ['exportId,attemptId,position', 0],
      export_chunk_position: ['exportId,position', 0],
    },
    sql: `CREATE TABLE identity_account_export_chunks (
      exportId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      attemptId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      position int UNSIGNED NOT NULL, payload mediumblob NOT NULL,
      sha256 char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      PRIMARY KEY (exportId, attemptId, position), UNIQUE KEY export_chunk_position (exportId, position),
      CONSTRAINT export_chunk_job FOREIGN KEY (exportId) REFERENCES identity_account_exports (id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  },
] as const;

export class AccountExports1791676832000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('identity_accounts')))
      throw new Error('Account exports require canonical accounts');
    for (const schema of schemas) {
      if (!(await runner.hasTable(schema.name))) {
        const applied: unknown[] = (await runner.hasTable('migrations'))
          ? await runner.query('SELECT id FROM migrations WHERE name = ?', [
              'AccountExports1791676832000',
            ])
          : [];
        if (applied.length)
          throw new Error(
            `Applied account export table is missing: ${schema.name}`
          );
        await runner.query(schema.sql);
      }
      const table = await runner.getTable(schema.name);
      const metadata: {
        name: string;
        engine: string;
        collation: string | null;
        extra: string;
      }[] = await runner.query(
        'SELECT c.COLUMN_NAME AS name, t.ENGINE AS engine, c.COLLATION_NAME AS collation, c.EXTRA AS extra FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = ?',
        [schema.name]
      );
      if (!table || table.columns.length !== schema.columns.length)
        throw new Error(`Incompatible ${schema.name} schema`);
      for (const [name, type, length, nullable] of schema.columns) {
        const column = table.columns.find((column) => column.name === name),
          meta = metadata.find((column) => column.name === name);
        if (
          !column ||
          column.type !== type ||
          column.isNullable !== nullable ||
          meta?.engine.toLowerCase() !== 'innodb' ||
          meta.extra !== '' ||
          (length
            ? column.length !== length ||
              meta.collation !==
                (name === 'identityId' ? 'utf8mb4_bin' : 'ascii_bin')
            : meta.collation !== null) ||
          (['bigint', 'int'].includes(type) && !column.unsigned)
        )
          throw new Error(`Incompatible ${schema.name}.${name}`);
      }
      const indexes: {
        name: string;
        columns: string;
        prefix: unknown;
        nonUnique: unknown;
      }[] = await runner.query(
        'SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns, MAX(SUB_PART) AS prefix, MIN(NON_UNIQUE) AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? GROUP BY INDEX_NAME',
        [schema.name]
      );
      if (indexes.length !== Object.keys(schema.indexes).length)
        throw new Error(`Incompatible ${schema.name} indexes`);
      for (const [name, [columns, nonUnique]] of Object.entries(
        schema.indexes
      )) {
        if (
          !indexes.some(
            (index) =>
              index.name === name &&
              index.columns === columns &&
              index.prefix === null &&
              canonicalSqlInteger(index.nonUnique) === nonUnique
          )
        )
          throw new Error(`Incompatible ${schema.name} index ${name}`);
      }
      if (schema.name === 'identity_account_export_chunks') {
        const key = table.foreignKeys[0];
        if (
          table.foreignKeys.length !== 1 ||
          key.name !== 'export_chunk_job' ||
          key.columnNames.join(',') !== 'exportId' ||
          key.referencedTableName !== 'identity_account_exports' ||
          key.referencedColumnNames.join(',') !== 'id' ||
          key.onDelete !== 'CASCADE'
        )
          throw new Error('Incompatible account export chunk ownership');
      } else if (table.foreignKeys.length)
        throw new Error('Incompatible account export foreign keys');
    }
    const orphans: unknown[] = await runner.query(
      'SELECT c.exportId FROM identity_account_export_chunks c LEFT JOIN identity_account_exports e ON e.id = c.exportId WHERE e.id IS NULL LIMIT 1'
    );
    if (orphans.length) throw new Error('Orphaned account export chunks');
    let after: string | null = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT e.*, i.identity_id AS existingOwner FROM identity_account_exports e LEFT JOIN identities i ON BINARY i.identity_id = BINARY e.identityId WHERE (? IS NULL OR e.id > ?) ORDER BY e.id LIMIT 32',
        [after, after]
      );
      for (const raw of rows) {
        const row = accountExportFromSql(raw);
        if (raw.existingOwner !== row.identityId)
          throw new Error('Missing account export identity');
        await this.validateChunks(runner, row);
      }
      if (rows.length < 32) break;
      after = accountExportId(rows[rows.length - 1].id);
    }
    const duplicates: unknown[] = await runner.query(
      "SELECT identityId FROM identity_account_exports WHERE status IN ('queued', 'building', 'ready') AND expiresAt > ? GROUP BY identityId HAVING COUNT(*) > 1 LIMIT 1",
      [Date.now()]
    );
    if (duplicates.length)
      throw new Error('Conflicting active account export jobs');
  }

  private async validateChunks(runner: QueryRunner, row: AccountExportRow) {
    let position = 0,
      bytes = 0,
      previousBytes = ACCOUNT_EXPORT_LIMITS.chunkBytes;
    const hash = createHash('sha256');
    for (;;) {
      const chunks: {
        attemptId: string;
        position: unknown;
        payload: Buffer;
        sha256: string;
      }[] = await runner.query(
        'SELECT attemptId, position, payload, sha256 FROM identity_account_export_chunks WHERE exportId = ? AND position >= ? ORDER BY position LIMIT 16',
        [row.id, position]
      );
      for (const chunk of chunks) {
        if (
          !['building', 'ready'].includes(row.status) ||
          chunk.attemptId !== row.leaseToken ||
          canonicalSqlInteger(chunk.position) !== position ||
          !Buffer.isBuffer(chunk.payload) ||
          !chunk.payload.length ||
          chunk.payload.length > ACCOUNT_EXPORT_LIMITS.chunkBytes ||
          previousBytes !== ACCOUNT_EXPORT_LIMITS.chunkBytes ||
          accountExportDigest(chunk.payload) !== chunk.sha256
        )
          throw new Error('Invalid account export chunk');
        hash.update(chunk.payload);
        bytes += chunk.payload.length;
        previousBytes = chunk.payload.length;
        position++;
        if (bytes > ACCOUNT_EXPORT_LIMITS.archiveBytes)
          throw new Error('Oversized account export');
      }
      if (chunks.length < 16) break;
    }
    if (
      row.artifact &&
      (row.artifact.chunks !== position ||
        row.artifact.bytes !== bytes ||
        row.artifact.sha256 !== hash.digest('hex'))
    )
      throw new Error('Account export artifact disagrees with stored chunks');
  }

  async down(): Promise<void> {
    throw new Error(
      'Account export rollback requires a reviewed data-preserving migration'
    );
  }
}
