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
  parseReleasePublicationReceipt,
  parseReleaseReceipt,
  parseReleaseTarget,
  releaseId,
  releaseRevision,
  releaseTimestamp,
  assertReleaseSubmissionDate,
} from '@domains/catalog/versioning';
import {
  canonicalRelease,
  releaseDraftFromRow,
  releaseJson,
  releaseSubmissionFromRow,
  type ReleaseDraftRow,
} from './mysql-release-state';
import { isEditorialScope } from '../application/editorial-materialization';

export class ReleaseWorkspace1791676817000 implements MigrationInterface {
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
    const uuid = (name: string, isPrimary = false) => ({
      name,
      type: 'varchar',
      length: '36',
      isPrimary,
    });
    const integer = (name: string, isNullable = false) => ({
      name,
      type: 'bigint',
      unsigned: true,
      isNullable,
    });
    const tables = [
      new Table({ name: 'release_workspaces', columns: scope }),
      new Table({
        name: 'release_drafts',
        columns: [
          uuid('id', true),
          ...scope.map((column) => ({ ...column, isPrimary: false })),
          uuid('applicationId'),
          uuid('releaseId'),
          uuid('claimId'),
          integer('sourcePublicationRevision', true),
          { name: 'fields', type: 'json', isNullable: true },
          integer('revision'),
          integer('createdAt'),
          integer('updatedAt'),
          integer('deletedAt', true),
        ],
        indices: [
          {
            name: 'idx_release_draft_owner',
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
        name: 'release_submissions',
        columns: [
          uuid('draftId', true),
          { ...integer('submittedRevision'), isPrimary: true },
          { name: 'target', type: 'json' },
          { name: 'fields', type: 'json' },
          { name: 'status', type: 'varchar', length: '16' },
          { name: 'reason', type: 'text' },
          {
            name: 'reviewerIdentityId',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          integer('submittedAt'),
          integer('reviewedAt', true),
        ],
        indices: [
          {
            name: 'idx_release_review_queue',
            columnNames: ['status', 'submittedAt', 'draftId'],
          },
        ],
      }),
      new Table({
        name: 'release_publications',
        columns: [
          uuid('releaseId', true),
          uuid('applicationId'),
          { name: 'tenantId', type: 'varchar', length: '128' },
          { name: 'version', type: 'varchar', length: '80' },
          { name: 'fields', type: 'json' },
          integer('publishedAt'),
          uuid('draftId'),
          integer('submittedRevision'),
        ],
        indices: [
          {
            name: 'uq_release_version',
            columnNames: ['tenantId', 'applicationId', 'version'],
            isUnique: true,
          },
        ],
      }),
      new Table({
        name: 'release_commands',
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
          uuid('draftId'),
          { name: 'kind', type: 'varchar', length: '16' },
          { name: 'receipt', type: 'json' },
          integer('createdAt'),
        ],
      }),
    ];
    const completed =
      (await runner.hasTable('editorial_migrations')) &&
      (
        await runner.query(
          'SELECT id FROM editorial_migrations WHERE name = ? LIMIT 1',
          ['ReleaseWorkspace1791676817000']
        )
      ).length > 0;
    // Validate every existing table before any nontransactional DDL; interrupted initial creation is resumable.
    if (await editorialAuditErasureApplied(runner))
      tables
        .find((table) => table.name === 'release_submissions')
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
      if (await runner.hasTable(table.name))
        await this.assertSchema(runner, table);
      else if (completed)
        throw new Error(`Missing completed release schema: ${table.name}`);
    }
    for (const table of tables)
      if (!(await runner.hasTable(table.name))) await runner.createTable(table);
    await this.validateRows(runner);
  }
  private async assertSchema(runner: QueryRunner, expected: Table) {
    const actual = await runner.getTable(expected.name);
    const [storage] = await runner.query(
      'SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [expected.name]
    );
    const physical: {
      name: string;
      collation: string | null;
      length: string | number | null;
    }[] = await runner.query(
      'SELECT COLUMN_NAME AS name, COLLATION_NAME AS collation, CHARACTER_MAXIMUM_LENGTH AS length FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [expected.name]
    );
    const indexes: {
      name: string;
      columnName: string;
      nonUnique: string | number;
    }[] = await runner.query(
      'SELECT INDEX_NAME AS name, COLUMN_NAME AS columnName, NON_UNIQUE AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX',
      [expected.name]
    );
    const matches = (name: string, columns: string[], unique: boolean) => {
      const rows = indexes.filter((item) => item.name === name);
      return (
        JSON.stringify(rows.map((item) => item.columnName)) ===
          JSON.stringify(columns) &&
        rows.every((item) => Number(item.nonUnique) === (unique ? 0 : 1))
      );
    };
    if (
      !actual ||
      storage?.engine !== 'InnoDB' ||
      actual.columns.length !== expected.columns.length ||
      !matches(
        'PRIMARY',
        expected.primaryColumns.map((column) => column.name),
        true
      ) ||
      expected.indices.some(
        (index) =>
          !index.name || !matches(index.name, index.columnNames, index.isUnique)
      ) ||
      expected.columns.some((column) => {
        const value = actual.columns.find((item) => item.name === column.name);
        const stored = physical.find((item) => item.name === column.name);
        return (
          !value ||
          value.type !== column.type ||
          value.isNullable !== column.isNullable ||
          value.unsigned !== column.unsigned ||
          value.isPrimary !== column.isPrimary ||
          (column.collation && stored?.collation !== column.collation) ||
          (column.length && String(stored?.length) !== column.length)
        );
      })
    )
      throw new Error(`Incompatible release schema: ${expected.name}`);
  }
  private async validateRows(runner: QueryRunner) {
    const anonymousReviews = await editorialAuditErasureApplied(runner);
    let cursor = '';
    for (;;) {
      const rows: ReleaseDraftRow[] = await runner.query(
        'SELECT * FROM release_drafts WHERE id > ? ORDER BY id LIMIT 200',
        [cursor]
      );
      for (const row of rows) {
        if (
          !isEditorialScope(row.tenantId) ||
          !isEditorialScope(row.ownerIdentityId)
        )
          throw new Error('Invalid release workspace scope');
        releaseId(row.id);
        releaseRevision(Number(row.revision));
        const created = releaseTimestamp(Number(row.createdAt)),
          updated = releaseTimestamp(Number(row.updatedAt));
        if (row.id === row.releaseId || updated < created)
          throw new Error('Invalid private release identity or timestamps');
        parseReleaseTarget({
          applicationId: row.applicationId,
          releaseId: row.releaseId,
          claimId: row.claimId,
          sourcePublicationRevision:
            row.sourcePublicationRevision === null
              ? null
              : Number(row.sourcePublicationRevision),
        });
        if (row.deletedAt === null) releaseDraftFromRow(row);
        else if (
          row.fields !== null ||
          releaseTimestamp(Number(row.deletedAt)) !== updated
        )
          throw new Error('Invalid release draft tombstone');
        let submittedCursor = 0;
        for (;;) {
          const submissions: Record<string, unknown>[] = await runner.query(
            'SELECT * FROM release_submissions WHERE draftId = ? AND submittedRevision > ? ORDER BY submittedRevision LIMIT 200',
            [row.id, submittedCursor]
          );
          for (const stored of submissions) {
            const value = releaseSubmissionFromRow(stored);
            const reviewed =
              value.status === 'approved' || value.status === 'rejected';
            assertEditorialReviewActor(
              {
                actor: stored.reviewerIdentityId,
                erasedAt: stored.reviewerErasedAt,
                owner: row.ownerIdentityId,
                reviewedAt: value.reviewedAt,
                decided: reviewed,
              },
              anonymousReviews
            );
            if (
              row.deletedAt !== null ||
              value.submittedRevision >= Number(row.revision) ||
              value.submittedAt < created ||
              value.submittedAt > updated ||
              (value.reviewedAt !== null && value.reviewedAt > updated) ||
              value.target.applicationId !== row.applicationId ||
              value.target.releaseId !== row.releaseId ||
              value.target.claimId !== row.claimId
            )
              throw new Error(
                'Invalid release submission authority or lifecycle'
              );
          }
          if (submissions.length < 200) break;
          submittedCursor = Number(
            submissions[submissions.length - 1].submittedRevision
          );
        }
      }
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].id;
    }
    cursor = '';
    for (;;) {
      const rows: { releaseId: string }[] = await runner.query(
        'SELECT releaseId FROM release_publications WHERE releaseId > ? ORDER BY releaseId LIMIT 200',
        [cursor]
      );
      for (const row of rows) {
        const publication = await canonicalRelease(
          runner.manager,
          row.releaseId
        );
        if (!publication) throw new Error('Missing release authority');
        assertReleaseSubmissionDate(
          publication.fields,
          publication.publishedAt
        );
      }
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].releaseId;
    }
    let receiptCursor: [string, string, string] = ['', '', ''];
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT * FROM release_commands WHERE (tenantId, actorIdentityId, commandKey) > (?, ?, ?) ORDER BY tenantId, actorIdentityId, commandKey LIMIT 200',
        receiptCursor
      );
      for (const row of rows) {
        const value = releaseJson(row.receipt);
        const receipt =
          row.kind === 'draft'
            ? parseReleaseReceipt(value)
            : row.kind === 'publication'
            ? parseReleasePublicationReceipt(value)
            : null;
        if (
          !receipt ||
          receipt.id !== row.draftId ||
          typeof row.fingerprint !== 'string' ||
          !/^[0-9a-f]{64}$/.test(row.fingerprint)
        )
          throw new Error('Invalid release receipt');
        if (
          !isEditorialScope(row.tenantId) ||
          !isEditorialScope(row.actorIdentityId) ||
          typeof row.commandKey !== 'string' ||
          !/^[A-Za-z0-9._:-]{1,128}$/.test(row.commandKey)
        )
          throw new Error('Invalid release receipt scope');
        releaseTimestamp(Number(row.createdAt));
      }
      if (rows.length < 200) break;
      const last = rows[rows.length - 1];
      receiptCursor = [
        String(last.tenantId),
        String(last.actorIdentityId),
        String(last.commandKey),
      ];
    }
    const checks = [
      `SELECT d.id FROM release_drafts d LEFT JOIN release_workspaces w ON w.tenantId = d.tenantId AND w.ownerIdentityId = d.ownerIdentityId
       LEFT JOIN application_ownership_claims c ON c.id = d.claimId LEFT JOIN editorial_resource_states a ON a.resourceKind = 'app' AND a.resourceId = d.applicationId
       LEFT JOIN release_publications p ON p.releaseId = d.releaseId LEFT JOIN editorial_resource_states e ON e.resourceKind = 'release' AND e.resourceId = d.releaseId
       WHERE w.ownerIdentityId IS NULL OR c.id IS NULL OR a.resourceId IS NULL OR a.tenantId <> d.tenantId OR c.tenantId <> d.tenantId OR c.claimantIdentityId <> d.ownerIdentityId
       OR c.applicationId <> d.applicationId OR c.status NOT IN ('approved','revoked') OR (p.releaseId IS NOT NULL AND (p.applicationId <> d.applicationId OR p.tenantId <> d.tenantId))
       OR (d.sourcePublicationRevision IS NOT NULL AND (e.resourceId IS NULL OR d.sourcePublicationRevision > e.revision)) LIMIT 1`,
      'SELECT tenantId FROM release_drafts WHERE deletedAt IS NULL GROUP BY tenantId, ownerIdentityId HAVING COUNT(*) > 100 LIMIT 1',
      "SELECT draftId FROM release_submissions WHERE status = 'submitted' GROUP BY draftId HAVING COUNT(*) > 1 LIMIT 1",
      'SELECT s.draftId FROM release_submissions s LEFT JOIN release_drafts d ON d.id = s.draftId WHERE d.id IS NULL LIMIT 1',
      `SELECT s.draftId FROM release_submissions s JOIN release_drafts d ON d.id = s.draftId
       LEFT JOIN editorial_resource_states e ON e.resourceKind = 'release' AND e.resourceId = d.releaseId
       WHERE JSON_TYPE(JSON_EXTRACT(s.target, '$.sourcePublicationRevision')) <> 'NULL'
       AND (e.resourceId IS NULL OR JSON_EXTRACT(s.target, '$.sourcePublicationRevision') > e.revision) LIMIT 1`,
      `SELECT p.releaseId FROM release_publications p LEFT JOIN release_drafts d ON d.id = p.draftId
       LEFT JOIN editorial_resource_states e ON e.resourceKind = 'release' AND e.resourceId = p.releaseId
       WHERE e.ownerIdentityId IS NOT NULL AND (d.id IS NULL OR d.tenantId <> p.tenantId OR d.applicationId <> p.applicationId OR d.releaseId <> p.releaseId OR p.submittedRevision >= d.revision
       OR e.ownerIdentityId <> d.ownerIdentityId OR p.publishedAt > d.updatedAt) LIMIT 1`,
      "SELECT e.resourceId FROM editorial_resource_states e LEFT JOIN release_publications p ON p.releaseId = e.resourceId WHERE e.resourceKind = 'release' AND p.releaseId IS NULL LIMIT 1",
      `SELECT c.draftId FROM release_commands c LEFT JOIN release_drafts d ON d.id = c.draftId
       WHERE d.id IS NULL OR c.tenantId <> d.tenantId OR JSON_EXTRACT(c.receipt, '$.revision') > d.revision
       OR c.createdAt < d.createdAt OR c.createdAt > d.updatedAt
       OR (JSON_EXTRACT(c.receipt, '$.deleted') = true AND d.deletedAt IS NULL)
       OR (c.kind = 'publication' AND JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.releaseId')) <> d.releaseId)
       OR ((c.kind = 'draft' OR JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.action')) IN ('submit','withdraw')) AND c.actorIdentityId <> d.ownerIdentityId)
       OR (JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.action')) IN ('approve','reject') AND c.actorIdentityId = d.ownerIdentityId) LIMIT 1`,
    ];
    for (const sql of checks)
      if ((await runner.query(sql)).length)
        throw new Error(
          'Invalid release authority, capacity or receipt relationships; repair explicitly'
        );
  }
  async down(): Promise<void> {
    throw new Error(
      'Release content, revisions and receipts are authoritative; use a reviewed data-preserving migration'
    );
  }
}
