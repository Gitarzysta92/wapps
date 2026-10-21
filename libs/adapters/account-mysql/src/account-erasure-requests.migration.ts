import type { MigrationInterface, QueryRunner } from 'typeorm';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import { canonicalSqlInteger } from './canonical-account-sql';

export class AccountErasureRequests1791840001000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('identity_erasure_barriers')))
      throw new Error('Account erasure requests require write barriers');
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
    if (!(await runner.hasTable('identity_erasure_requests'))) {
      if (applied.length)
        throw new Error('Applied account erasure request table is missing');
      await runner.query(`CREATE TABLE identity_erasure_requests (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
        revision bigint UNSIGNED NOT NULL, requestedAt bigint UNSIGNED NOT NULL, completedAt bigint UNSIGNED NULL,
        INDEX idx_erasure_requests_pending (completedAt, identityId)
      ) ENGINE=InnoDB`);
    }
    const table = await runner.getTable('identity_erasure_requests');
    const metadata: {
      engine: string;
      name: string;
      collation: string | null;
    }[] = await runner.query(
      "SELECT t.ENGINE AS engine, c.COLUMN_NAME AS name, c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME='identity_erasure_requests'"
    );
    const triggers: unknown[] = await runner.query(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE='identity_erasure_requests'"
    );
    // TypeORM's MySQL index enumeration does not preserve SEQ_IN_INDEX.
    const indexes: {
      columns: string;
      columnCount: number | string;
      prefix: number | null;
      nonUnique: number | string;
    }[] = await runner.query(
      "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns, COUNT(*) AS columnCount, MAX(SUB_PART) AS prefix, MIN(NON_UNIQUE) AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='identity_erasure_requests' GROUP BY INDEX_NAME"
    );
    if (
      !table ||
      table.columns.length !== 4 ||
      table.primaryColumns.length !== 1 ||
      table.primaryColumns[0].name !== 'identityId' ||
      table.foreignKeys.length ||
      triggers.length ||
      [
        ...table.uniques,
        ...table.indices.filter((index) => index.isUnique),
      ].some((index) => index.columnNames.join(',') !== 'identityId') ||
      !indexes.some(
        (index) =>
          Number(index.nonUnique) === 1 &&
          Number(index.columnCount) === 2 &&
          index.prefix === null &&
          index.columns === 'completedAt,identityId'
      )
    )
      throw new Error('Incompatible account erasure request schema');
    for (const name of [
      'identityId',
      'revision',
      'requestedAt',
      'completedAt',
    ]) {
      const column = table.columns.find((entry) => entry.name === name),
        info = metadata.find((entry) => entry.name === name);
      if (
        !column ||
        column.isGenerated ||
        info?.engine.toLowerCase() !== 'innodb' ||
        column.isNullable !== (name === 'completedAt') ||
        (name === 'identityId'
          ? column.type !== 'varchar' ||
            column.length !== '128' ||
            info.collation !== 'utf8mb4_bin'
          : column.type !== 'bigint' || !column.unsigned)
      )
        throw new Error(`Incompatible identity_erasure_requests.${name}`);
    }
    if (!applied.length) {
      let after: string | null = null;
      for (;;) {
        const barriers: {
          identityId: string;
          erasureRevision: unknown;
          requestedAt: unknown;
        }[] = await runner.query(
          'SELECT identityId, erasureRevision, requestedAt FROM identity_erasure_barriers WHERE erasureRevision IS NOT NULL AND (? IS NULL OR identityId > ?) ORDER BY identityId LIMIT 256',
          [after, after]
        );
        for (const barrier of barriers) {
          if (!isCanonicalIdentityId(barrier.identityId))
            throw new Error('Invalid account erasure barrier');
          await runner.query(
            'INSERT INTO identity_erasure_requests (identityId, revision, requestedAt, completedAt) VALUES (?, ?, ?, NULL) ON DUPLICATE KEY UPDATE identityId = identityId',
            [
              barrier.identityId,
              canonicalSqlInteger(barrier.erasureRevision, 1),
              canonicalSqlInteger(barrier.requestedAt, 1),
            ]
          );
          after = barrier.identityId;
        }
        if (barriers.length < 256) break;
      }
    }
    const missing: unknown[] =
      await runner.query(`SELECT b.identityId FROM identity_erasure_barriers b LEFT JOIN identity_erasure_requests r ON r.identityId=b.identityId
      WHERE b.erasureRevision IS NOT NULL AND r.identityId IS NULL LIMIT 1`);
    if (missing.length)
      throw new Error(
        'An account erasure request is missing for a retained barrier'
      );
    let after: string | null = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        `SELECT r.*, b.erasureRevision, b.requestedAt AS barrierAt FROM identity_erasure_requests r
        LEFT JOIN identity_erasure_barriers b ON b.identityId=r.identityId WHERE (? IS NULL OR r.identityId > ?) ORDER BY r.identityId LIMIT 256`,
        [after, after]
      );
      for (const row of rows) {
        if (
          !isCanonicalIdentityId(row.identityId) ||
          canonicalSqlInteger(row.revision, 1) !==
            canonicalSqlInteger(row.erasureRevision, 1) ||
          canonicalSqlInteger(row.requestedAt, 1) !==
            canonicalSqlInteger(row.barrierAt, 1) ||
          (row.completedAt !== null &&
            canonicalSqlInteger(row.completedAt, 1) <
              canonicalSqlInteger(row.requestedAt, 1))
        )
          throw new Error('Invalid canonical account erasure request');
        after = row.identityId;
      }
      if (rows.length < 256) break;
    }
  }
  async down(): Promise<void> {
    throw new Error(
      'Account erasure requests require a reviewed data-preserving rollback'
    );
  }
}
