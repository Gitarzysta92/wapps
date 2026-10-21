import { includeClassificationColumn } from '../content-classification/content-classification-schema';
import { assertEditorialMigrationIndexes } from '../infrastructure/editorial-schema-compatibility';
import {
  assertEditorialReviewActor,
  editorialAuditErasureApplied,
} from '../account-erasure/editorial-audit-erasure-schema';
import {
  Table,
  TableColumn,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

export class SuitePublication1791676809000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner, snapshotsPending = false) {
    const snapshots =
      snapshotsPending ||
      ((await runner.hasTable('editorial_migrations')) &&
        (
          await runner.query(
            "SELECT 1 FROM editorial_migrations WHERE name='SuitePublicationSnapshots1791840009000' LIMIT 1"
          )
        ).length > 0);
    const tables = [
      new Table({
        name: 'suite_submissions',
        columns: [
          { name: 'suiteId', type: 'varchar', length: '36', isPrimary: true },
          {
            name: 'submittedRevision',
            type: 'bigint',
            unsigned: true,
            isPrimary: true,
          },
          { name: 'tenantId', type: 'varchar', length: '128' },
          { name: 'ownerIdentityId', type: 'varchar', length: '128' },
          { name: 'title', type: 'varchar', length: '100' },
          { name: 'description', type: 'text' },
          { name: 'applicationIds', type: 'json' },
          { name: 'status', type: 'varchar', length: '16' },
          { name: 'reason', type: 'text' },
          {
            name: 'reviewerIdentityId',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          { name: 'submittedAt', type: 'bigint', unsigned: true },
          {
            name: 'reviewedAt',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'idx_suite_review_queue',
            columnNames: ['tenantId', 'status', 'submittedAt', 'suiteId'],
          },
        ],
      }),
      new Table({
        name: 'suite_publications',
        columns: [
          { name: 'suiteId', type: 'varchar', length: '36', isPrimary: true },
          { name: 'submittedRevision', type: 'bigint', unsigned: true },
          { name: 'publishedAt', type: 'bigint', unsigned: true },
        ],
      }),
      new Table({
        name: 'suite_publication_commands',
        columns: [
          { name: 'tenantId', type: 'varchar', length: '128', isPrimary: true },
          {
            name: 'actorIdentityId',
            type: 'varchar',
            length: '128',
            isPrimary: true,
          },
          {
            name: 'commandKey',
            type: 'varchar',
            length: '128',
            isPrimary: true,
          },
          { name: 'fingerprint', type: 'char', length: '64' },
          { name: 'suiteId', type: 'varchar', length: '36' },
          { name: 'receipt', type: 'json' },
          { name: 'createdAt', type: 'bigint', unsigned: true },
        ],
      }),
    ];
    if (snapshots) {
      const publication = tables.find(
        (table) => table.name === 'suite_publications'
      );
      if (!publication) throw new Error('Missing suite publication schema');
      publication.addColumn(
        new TableColumn({ name: 'title', type: 'varchar', length: '100' })
      );
      publication.addColumn(
        new TableColumn({ name: 'description', type: 'text' })
      );
      publication.addColumn(
        new TableColumn({ name: 'applicationIds', type: 'json' })
      );
    }
    if (await editorialAuditErasureApplied(runner))
      tables
        .find((table) => table.name === 'suite_submissions')
        ?.addColumn(
          new TableColumn({
            name: 'reviewerErasedAt',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          })
        );
    for (const table of tables) {
      table.engine = 'InnoDB';
      for (const column of table.columns)
        if (['varchar', 'char', 'text'].includes(column.type)) {
          column.charset = 'utf8mb4';
          column.collation = 'utf8mb4_bin';
        }
      if (!(await runner.hasTable(table.name))) await runner.createTable(table);
      const actual = await runner.getTable(table.name);
      includeClassificationColumn(table, actual);
      await assertEditorialMigrationIndexes(runner, table);
      const [storage] = await runner.query(
        'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [table.name]
      );
      const physical: { name: string; collation: string | null }[] =
        await runner.query(
          'SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
          [table.name]
        );
      const keys: { name: string }[] = await runner.query(
        "SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX",
        [table.name]
      );
      if (
        storage?.engine !== 'InnoDB' ||
        !actual ||
        actual.columns.length !== table.columns.length ||
        JSON.stringify(keys.map((row) => row.name)) !==
          JSON.stringify(table.primaryColumns.map((column) => column.name)) ||
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
        throw new Error(`Incompatible suite publication schema: ${table.name}`);
    }
    const anonymousReviews = await editorialAuditErasureApplied(runner);
    let reviewCursor: [string, number] = ['', 0];
    for (;;) {
      const rows: {
        suiteId: string;
        submittedRevision: string | number;
        tenantId: string;
        ownerIdentityId: string;
        reviewerIdentityId: string | null;
        reviewerErasedAt?: unknown;
        reviewedAt: string | number | null;
        status: string;
      }[] = await runner.query(
        'SELECT * FROM suite_submissions WHERE (suiteId,submittedRevision)>(?,?) ORDER BY suiteId,submittedRevision LIMIT 128',
        reviewCursor
      );
      for (const row of rows) {
        assertEditorialReviewActor(
          {
            actor: row.reviewerIdentityId,
            erasedAt: row.reviewerErasedAt,
            owner: row.ownerIdentityId,
            reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
            decided: row.status === 'approved' || row.status === 'rejected',
          },
          anonymousReviews
        );
        reviewCursor = [row.suiteId, Number(row.submittedRevision)];
      }
      if (rows.length < 128) break;
    }
    const invalid =
      await runner.query(`SELECT s.suiteId FROM suite_submissions s LEFT JOIN private_suites p ON p.id = s.suiteId
      WHERE p.id IS NULL OR p.deletedAt IS NOT NULL OR s.tenantId <> p.tenantId OR s.ownerIdentityId <> p.ownerIdentityId
      OR s.submittedRevision < 1 OR s.submittedRevision >= p.revision OR s.status NOT IN ('submitted','approved','rejected','cancelled')
      OR ((s.status = 'submitted') <> (s.reviewedAt IS NULL)) OR s.reviewedAt < s.submittedAt
      OR JSON_TYPE(s.applicationIds) <> 'ARRAY' OR JSON_LENGTH(s.applicationIds) NOT BETWEEN 1 AND 50
      OR CHAR_LENGTH(TRIM(s.title)) < 1 OR CHAR_LENGTH(s.description) > 1000 OR CHAR_LENGTH(s.reason) > 1000
      OR (s.status = 'rejected' AND CHAR_LENGTH(TRIM(s.reason)) = 0) LIMIT 1`);
    const publications = snapshots
      ? await runner.query(`SELECT p.suiteId FROM suite_publications p
      LEFT JOIN editorial_resource_states e ON e.resourceKind='suite' AND e.resourceId=p.suiteId
      WHERE e.resourceId IS NULL OR p.submittedRevision < 1 LIMIT 1`)
      : await runner.query(`SELECT p.suiteId FROM suite_publications p
      LEFT JOIN suite_submissions s ON s.suiteId = p.suiteId AND s.submittedRevision = p.submittedRevision
      LEFT JOIN editorial_resource_states e ON e.resourceKind = 'suite' AND e.resourceId = p.suiteId
      WHERE s.suiteId IS NULL OR s.status <> 'approved' OR e.resourceId IS NULL OR e.tenantId <> s.tenantId OR e.ownerIdentityId <> s.ownerIdentityId LIMIT 1`);
    const pending = await runner.query(
      "SELECT suiteId FROM suite_submissions WHERE status = 'submitted' GROUP BY suiteId HAVING COUNT(*) > 1 LIMIT 1"
    );
    const states =
      await runner.query(`SELECT e.resourceId FROM editorial_resource_states e
      LEFT JOIN suite_publications p ON p.suiteId = e.resourceId
      WHERE e.resourceKind = 'suite' AND e.deletedAt IS NULL AND p.suiteId IS NULL LIMIT 1`);
    const receipts =
      await runner.query(`SELECT c.suiteId FROM suite_publication_commands c
      LEFT JOIN private_suites p ON p.id = c.suiteId AND p.tenantId = c.tenantId
      WHERE p.id IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.id')) <> c.suiteId
      OR JSON_EXTRACT(c.receipt, '$.revision') > p.revision LIMIT 1`);
    if (
      invalid.length ||
      publications.length ||
      pending.length ||
      states.length ||
      receipts.length
    )
      throw new Error(
        'Invalid suite submission or publication relationships; repair explicitly'
      );
  }
  async down(): Promise<void> {
    throw new Error(
      'Suite review history and publication are authoritative; use a reviewed data-preserving migration'
    );
  }
}
