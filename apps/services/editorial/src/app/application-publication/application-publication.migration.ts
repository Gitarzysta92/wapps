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
import {
  applicationDraftId,
  applicationDraftRevision,
  parseApplicationPublicationReceipt,
} from '@domains/catalog/record';
import { applicationSubmissionFromRow } from './mysql-application-publication';

interface SubmissionRow extends Record<string, unknown> {
  applicationId: string;
  submittedRevision: number | string;
  tenantId: string;
  ownerIdentityId: string;
  status: string;
  reviewerIdentityId: string | null;
  reviewerErasedAt?: unknown;
}
interface CommandRow {
  applicationId: string;
  tenantId: string;
  actorIdentityId: string;
  commandKey: string;
  fingerprint: string;
  receipt: unknown;
  createdAt: number | string;
}

export class ApplicationPublication1791676811000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    const anonymousReviews = await editorialAuditErasureApplied(runner);
    const catalog = await runner.getTable('app_records');
    const website = catalog?.columns.find(
      (column) => column.name === 'website'
    );
    if (
      !website ||
      website.type !== 'varchar' ||
      !website.isNullable ||
      !['500', '2048'].includes(website.length)
    )
      throw new Error('Incompatible catalog website column');
    if (website.length === '500') {
      const expanded = website.clone();
      expanded.length = '2048';
      await runner.changeColumn('app_records', website, expanded);
    }
    const tables = [
      new Table({
        name: 'application_submissions',
        columns: [
          {
            name: 'applicationId',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'submittedRevision',
            type: 'bigint',
            unsigned: true,
            isPrimary: true,
          },
          { name: 'tenantId', type: 'varchar', length: '128' },
          { name: 'ownerIdentityId', type: 'varchar', length: '128' },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'slug', type: 'varchar', length: '80' },
          { name: 'website', type: 'varchar', length: '2048' },
          { name: 'description', type: 'text' },
          {
            name: 'basePublicationRevision',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
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
            name: 'idx_application_review_queue',
            columnNames: ['tenantId', 'status', 'submittedAt', 'applicationId'],
          },
        ],
      }),
      new Table({
        name: 'application_publications',
        columns: [
          {
            name: 'applicationId',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          { name: 'submittedRevision', type: 'bigint', unsigned: true },
          { name: 'publicationRevision', type: 'bigint', unsigned: true },
          { name: 'publishedAt', type: 'bigint', unsigned: true },
        ],
      }),
      new Table({
        name: 'application_publication_commands',
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
          { name: 'applicationId', type: 'varchar', length: '36' },
          { name: 'receipt', type: 'json' },
          { name: 'createdAt', type: 'bigint', unsigned: true },
        ],
      }),
    ];
    if (await editorialAuditErasureApplied(runner))
      tables
        .find((table) => table.name === 'application_submissions')
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
        throw new Error(
          `Incompatible application publication schema: ${table.name}`
        );
    }
    let cursor: [string, number] | null = null;
    for (;;) {
      const rows: SubmissionRow[] = await runner.query(
        'SELECT * FROM application_submissions' +
          (cursor ? ' WHERE (applicationId, submittedRevision) > (?, ?)' : '') +
          ' ORDER BY applicationId, submittedRevision LIMIT 200',
        cursor ?? []
      );
      for (const row of rows) {
        applicationDraftId(row.applicationId);
        applicationSubmissionFromRow(row);
        const decided = row.status === 'approved' || row.status === 'rejected';
        if (!row.tenantId.trim() || !row.ownerIdentityId.trim())
          throw new Error('Invalid application submission ownership');
        assertEditorialReviewActor(
          {
            actor: row.reviewerIdentityId,
            erasedAt: row.reviewerErasedAt,
            owner: row.ownerIdentityId,
            reviewedAt: row.reviewedAt === null ? null : Number(row.reviewedAt),
            decided,
          },
          anonymousReviews
        );
      }
      if (rows.length < 200) break;
      const last = rows[rows.length - 1];
      cursor = [last.applicationId, Number(last.submittedRevision)];
    }
    let receiptCursor: [string, string, string] | null = null;
    for (;;) {
      const rows: CommandRow[] = await runner.query(
        'SELECT * FROM application_publication_commands' +
          (receiptCursor
            ? ' WHERE (tenantId, actorIdentityId, commandKey) > (?, ?, ?)'
            : '') +
          ' ORDER BY tenantId, actorIdentityId, commandKey LIMIT 200',
        receiptCursor ?? []
      );
      for (const row of rows) {
        const receipt = parseApplicationPublicationReceipt(
          typeof row.receipt === 'string'
            ? JSON.parse(row.receipt)
            : row.receipt
        );
        const at = applicationDraftRevision(Number(row.createdAt));
        if (
          receipt.id !== row.applicationId ||
          !row.tenantId.trim() ||
          !row.actorIdentityId.trim() ||
          !/^[A-Za-z0-9._:-]{1,128}$/.test(row.commandKey) ||
          !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
          at > 8_640_000_000_000_000
        )
          throw new Error('Invalid application publication receipt');
      }
      if (rows.length < 200) break;
      const last = rows[rows.length - 1];
      receiptCursor = [last.tenantId, last.actorIdentityId, last.commandKey];
    }
    const invalid =
      await runner.query(`SELECT s.applicationId FROM application_submissions s LEFT JOIN application_drafts p ON p.id = s.applicationId
      WHERE p.id IS NULL OR p.deletedAt IS NOT NULL OR s.tenantId <> p.tenantId OR s.ownerIdentityId <> p.ownerIdentityId
      OR s.submittedRevision < 1 OR s.submittedRevision >= p.revision OR s.status NOT IN ('submitted','approved','rejected','cancelled')
      OR ((s.status = 'submitted') <> (s.reviewedAt IS NULL)) OR s.reviewedAt < s.submittedAt
      OR s.submittedAt < p.createdAt OR s.submittedAt > p.updatedAt OR s.reviewedAt > p.updatedAt
      OR CHAR_LENGTH(TRIM(s.name)) NOT BETWEEN 2 AND 100 OR CHAR_LENGTH(s.description) NOT BETWEEN 20 AND 2000 OR CHAR_LENGTH(s.reason) > 1000
      OR (s.basePublicationRevision IS NOT NULL AND s.basePublicationRevision < 1)
      OR (s.status = 'rejected' AND CHAR_LENGTH(TRIM(s.reason)) = 0) LIMIT 1`);
    // Publication points at historical submitted content. A later verified transfer changes its owner.
    const ownershipHistory = await runner.hasTable(
      'application_ownership_grants'
    );
    const editingTargets = await runner.hasTable('application_editing_targets');
    const transferredOwner = ownershipHistory
      ? `EXISTS (SELECT 1 FROM application_ownership_grants g
        JOIN application_ownership_claims c ON c.id = g.claimId
        JOIN application_ownership_decisions d ON d.claimId = c.id AND d.action = 'approve'
        WHERE g.applicationId = e.resourceId AND g.tenantId = e.tenantId
        AND g.claimantIdentityId = e.ownerIdentityId AND c.applicationId = g.applicationId
        AND c.tenantId = g.tenantId AND c.claimantIdentityId = g.claimantIdentityId
        AND d.applicationRevision > p.publicationRevision AND d.applicationRevision <= e.revision
        AND d.createdAt >= p.publishedAt AND d.createdAt = g.grantedAt)`
      : 'FALSE';
    const publications =
      await runner.query(`SELECT p.applicationId FROM application_publications p
      LEFT JOIN application_submissions s ON s.applicationId = p.applicationId AND s.submittedRevision = p.submittedRevision
      ${
        editingTargets
          ? 'LEFT JOIN application_editing_targets t ON t.draftId = p.applicationId'
          : ''
      }
      LEFT JOIN editorial_resource_states e ON e.resourceKind = 'app' AND e.resourceId = ${
        editingTargets
          ? 'COALESCE(t.applicationId, p.applicationId)'
          : 'p.applicationId'
      }
      WHERE s.applicationId IS NULL OR s.status <> 'approved' OR e.resourceId IS NULL OR e.tenantId <> s.tenantId
      OR (e.ownerIdentityId <> s.ownerIdentityId AND NOT (${transferredOwner}))
      OR p.publicationRevision < 1 OR p.publicationRevision > e.revision OR p.publishedAt <> s.reviewedAt LIMIT 1`);
    const pending = await runner.query(
      "SELECT applicationId FROM application_submissions WHERE status = 'submitted' GROUP BY applicationId HAVING COUNT(*) > 1 LIMIT 1"
    );
    const receipts =
      await runner.query(`SELECT c.applicationId FROM application_publication_commands c
      LEFT JOIN application_drafts p ON p.id = c.applicationId AND p.tenantId = c.tenantId
      ${
        editingTargets
          ? 'LEFT JOIN application_editing_targets t ON t.draftId = c.applicationId'
          : ''
      }
      LEFT JOIN editorial_resource_states e ON e.resourceKind = 'app' AND e.resourceId = ${
        editingTargets
          ? 'COALESCE(t.applicationId, c.applicationId)'
          : 'c.applicationId'
      }
      WHERE p.id IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.id')) <> c.applicationId
      OR JSON_EXTRACT(c.receipt, '$.revision') > p.revision
      OR c.createdAt < p.createdAt OR c.createdAt > p.updatedAt
      OR (JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.action')) IN ('submit','withdraw') AND c.actorIdentityId <> p.ownerIdentityId)
      OR (JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.action')) IN ('approve','reject') AND c.actorIdentityId = p.ownerIdentityId)
      OR (JSON_TYPE(JSON_EXTRACT(c.receipt, '$.publicationRevision')) <> 'NULL' AND (e.resourceId IS NULL OR JSON_EXTRACT(c.receipt, '$.publicationRevision') > e.revision)) LIMIT 1`);
    if (
      invalid.length ||
      publications.length ||
      pending.length ||
      receipts.length
    )
      throw new Error(
        'Invalid application submission or publication relationships; repair explicitly'
      );
  }
  async down(): Promise<void> {
    throw new Error(
      'Application review history and publication are authoritative; use a reviewed data-preserving migration'
    );
  }
}
