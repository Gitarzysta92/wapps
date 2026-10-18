import type { MigrationInterface, QueryRunner } from 'typeorm';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import { canonicalSqlInteger } from './canonical-account-sql';

/** Credential-only receipts remain history; every tombstone acquires separate cross-service work. */
export class AccountErasureCoordination1791840002000
  implements MigrationInterface
{
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    const original = await runner.getTable('identity_deletion_jobs');
    if (!original || !(await runner.hasTable('identity_erasure_requests')))
      throw new Error(
        'Erasure coordination requires canonical deletion and participant requests'
      );
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const applied: unknown[] = (await runner.hasTable(history))
      ? await runner.query(
          `SELECT name FROM ${runner.connection.driver.escape(
            history
          )} WHERE name = ?`,
          [this.constructor.name]
        )
      : [];
    if (!(await runner.hasTable('identity_erasure_jobs'))) {
      if (applied.length)
        throw new Error(
          'Applied account erasure coordination table is missing'
        );
      await runner.query(
        'CREATE TABLE identity_erasure_jobs LIKE identity_deletion_jobs'
      );
    }
    const table = await runner.getTable('identity_erasure_jobs');
    const metadata: {
      engine: string;
      collation: string | null;
      name: string;
    }[] = await runner.query(
      "SELECT t.ENGINE AS engine, c.COLLATION_NAME AS collation, c.COLUMN_NAME AS name FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME='identity_erasure_jobs'"
    );
    const triggers: unknown[] = await runner.query(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='identity_erasure_jobs'"
    );
    // TypeORM's MySQL index enumeration does not preserve SEQ_IN_INDEX.
    const indexes: {
      columns: string;
      columnCount: number | string;
      prefix: number | null;
      nonUnique: number | string;
    }[] = await runner.query(
      "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns, COUNT(*) AS columnCount, MAX(SUB_PART) AS prefix, MIN(NON_UNIQUE) AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='identity_erasure_jobs' GROUP BY INDEX_NAME"
    );
    if (
      !table ||
      table.columns.length !== original.columns.length ||
      table.primaryColumns.map((column) => column.name).join(',') !==
        'identityId' ||
      table.foreignKeys.length ||
      triggers.length ||
      [
        ...table.uniques,
        ...table.indices.filter((index) => index.isUnique),
      ].some((index) => index.columnNames.join(',') !== 'identityId') ||
      !indexes.some(
        (index) =>
          Number(index.nonUnique) === 1 &&
          Number(index.columnCount) === 4 &&
          index.prefix === null &&
          index.columns === 'completedAt,failedAt,availableAt,leasedUntil'
      )
    )
      throw new Error('Incompatible account erasure coordination schema');
    for (const expected of original.columns) {
      const column = table.columns.find(
          (entry) => entry.name === expected.name
        ),
        info = metadata.find((entry) => entry.name === expected.name);
      if (
        !column ||
        info?.engine.toLowerCase() !== 'innodb' ||
        ['type', 'length', 'isNullable', 'unsigned', 'isGenerated'].some(
          (key) => Reflect.get(column, key) !== Reflect.get(expected, key)
        ) ||
        (column.type === 'varchar' && info.collation !== 'utf8mb4_bin') ||
        (expected.name === 'attempts' &&
          !['0', "'0'"].includes(String(column.default)))
      )
        throw new Error(`Incompatible identity_erasure_jobs.${expected.name}`);
    }
    // Restartable keyset backfill preserves both old credential receipts and any new erasure progress.
    let after: string | null = null;
    for (;;) {
      const identities: {
        identity_id: string;
        revision: unknown;
        deleted_at: unknown;
        is_active: number;
      }[] = await runner.query(
        'SELECT identity_id, revision, deleted_at, is_active FROM identities WHERE is_deleted = 1 AND (? IS NULL OR identity_id > ?) ORDER BY identity_id LIMIT 256',
        [after, after]
      );
      for (const identity of identities) {
        if (
          !isCanonicalIdentityId(identity.identity_id) ||
          identity.is_active !== 0
        )
          throw new Error('Invalid account erasure tombstone');
        const revision = canonicalSqlInteger(identity.revision, 1),
          at = canonicalSqlInteger(identity.deleted_at, 1);
        const [job]: { identityId: string }[] = await runner.query(
          'SELECT identityId FROM identity_erasure_jobs WHERE identityId = ?',
          [identity.identity_id]
        );
        if (!job) {
          if (applied.length)
            throw new Error(
              'Retained account tombstone is missing erasure coordination'
            );
          await runner.query(
            'INSERT INTO identity_erasure_jobs (identityId, revision, createdAt, availableAt) VALUES (?, ?, ?, ?)',
            [identity.identity_id, revision, at, at]
          );
        }
        after = identity.identity_id;
      }
      if (identities.length < 256) break;
    }
    after = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        `SELECT j.*, i.revision AS identityRevision, i.is_deleted, i.is_active FROM identity_erasure_jobs j
        LEFT JOIN identities i ON i.identity_id=j.identityId WHERE (? IS NULL OR j.identityId > ?) ORDER BY j.identityId LIMIT 256`,
        [after, after]
      );
      for (const row of rows) {
        if (
          !isCanonicalIdentityId(row.identityId) ||
          row.is_deleted !== 1 ||
          row.is_active !== 0 ||
          canonicalSqlInteger(row.revision, 1) !==
            canonicalSqlInteger(row.identityRevision, 1) ||
          canonicalSqlInteger(row.availableAt, 1) <
            canonicalSqlInteger(row.createdAt, 1) ||
          canonicalSqlInteger(row.attempts) > 12 ||
          (row.leaseToken === null) !== (row.leasedUntil === null) ||
          (row.leaseToken !== null &&
            (typeof row.leaseToken !== 'string' ||
              !/^[0-9a-f-]{36}$/.test(row.leaseToken) ||
              canonicalSqlInteger(row.leasedUntil, 1) <
                canonicalSqlInteger(row.availableAt, 1))) ||
          (row.completedAt !== null && row.failedAt !== null) ||
          ([row.completedAt, row.failedAt].some((value) => value !== null) &&
            row.leaseToken !== null)
        )
          throw new Error('Invalid account erasure coordination journal');
        for (const value of [row.completedAt, row.failedAt])
          if (
            value !== null &&
            canonicalSqlInteger(value, 1) <
              canonicalSqlInteger(row.createdAt, 1)
          )
            throw new Error('Invalid erasure completion timestamp');
        after = row.identityId;
      }
      if (rows.length < 256) break;
    }
  }
  async down(): Promise<void> {
    throw new Error(
      'Account erasure coordination requires a reviewed data-preserving rollback'
    );
  }
}
