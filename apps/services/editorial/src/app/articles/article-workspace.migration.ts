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
  articleId,
  articleRevision,
  articleTimestamp,
  parseArticleReceipt,
  parseArticlePublicationReceipt,
} from '@domains/publication/article';
import {
  articleDraftFromRow,
  articleSubmissionFromRow,
  articleJson,
  canonicalArticle,
  type ArticleDraftRow,
} from './mysql-article-state';
import { isEditorialScope } from '../application/editorial-materialization';
import { editorialAuthorErasureApplied } from '../account-erasure/editorial-erasure-schema';

export class ArticleWorkspace1791676818000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner, anonymousPending = false) {
    const anonymous =
      anonymousPending || (await editorialAuthorErasureApplied(runner));
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
      new Table({ name: 'article_workspaces', columns: scope }),
      new Table({
        name: 'article_drafts',
        columns: [
          uuid('id', true),
          ...scope.map((column) => ({ ...column, isPrimary: false })),
          { name: 'fields', type: 'json', isNullable: true },
          integer('revision'),
          integer('createdAt'),
          integer('updatedAt'),
          integer('deletedAt', true),
        ],
        indices: [
          {
            name: 'idx_article_draft_owner',
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
        name: 'article_submissions',
        columns: [
          uuid('articleId', true),
          { ...integer('submittedRevision'), isPrimary: true },
          integer('sourcePublicationRevision', true),
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
            name: 'idx_article_review_queue',
            columnNames: ['status', 'submittedAt', 'articleId'],
          },
        ],
      }),
      new Table({
        name: 'article_publications',
        columns: [
          uuid('articleId', true),
          ...scope.map((column) => ({
            ...column,
            isPrimary: false,
            isNullable: anonymous && column.name === 'ownerIdentityId',
          })),
          { name: 'slug', type: 'varchar', length: '100' },
          { name: 'title', type: 'varchar', length: '160' },
          { name: 'category', type: 'varchar', length: '80' },
          { name: 'fields', type: 'json' },
          integer('submittedRevision'),
          integer('publishedAt'),
          integer('updatedAt'),
        ],
        indices: [
          {
            name: 'uq_article_slug',
            columnNames: ['tenantId', 'slug'],
            isUnique: true,
          },
          {
            name: 'idx_article_browse',
            columnNames: ['tenantId', 'publishedAt', 'articleId'],
          },
          {
            name: 'idx_article_category',
            columnNames: ['tenantId', 'category', 'publishedAt', 'articleId'],
          },
        ],
      }),
      new Table({
        name: 'article_commands',
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
          uuid('articleId'),
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
          ['ArticleWorkspace1791676818000']
        )
      ).length > 0;
    if (await editorialAuditErasureApplied(runner))
      tables
        .find((table) => table.name === 'article_submissions')
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
        throw new Error(`Missing completed article schema: ${table.name}`);
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
      throw new Error(`Incompatible article schema: ${expected.name}`);
  }
  private async validateRows(runner: QueryRunner) {
    const anonymousReviews = await editorialAuditErasureApplied(runner);
    let cursor = '';
    for (;;) {
      const rows: ArticleDraftRow[] = await runner.query(
        'SELECT * FROM article_drafts WHERE id > ? ORDER BY id LIMIT 200',
        [cursor]
      );
      for (const row of rows) {
        if (
          !isEditorialScope(row.tenantId) ||
          !isEditorialScope(row.ownerIdentityId)
        )
          throw new Error('Invalid article scope');
        articleId(row.id);
        articleRevision(Number(row.revision));
        const created = articleTimestamp(Number(row.createdAt)),
          updated = articleTimestamp(Number(row.updatedAt));
        if (updated < created)
          throw new Error('Invalid article draft timestamps');
        if (row.deletedAt === null) articleDraftFromRow(row);
        else if (
          row.fields !== null ||
          articleTimestamp(Number(row.deletedAt)) !== updated
        )
          throw new Error('Invalid article draft tombstone');
        let submittedCursor = 0;
        for (;;) {
          const submissions: Record<string, unknown>[] = await runner.query(
            'SELECT * FROM article_submissions WHERE articleId = ? AND submittedRevision > ? ORDER BY submittedRevision LIMIT 200',
            [row.id, submittedCursor]
          );
          for (const stored of submissions) {
            const value = articleSubmissionFromRow(stored);
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
              (value.reviewedAt !== null && value.reviewedAt > updated)
            )
              throw new Error('Invalid article review authority or lifecycle');
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
      const rows: { articleId: string }[] = await runner.query(
        'SELECT articleId FROM article_publications WHERE articleId > ? ORDER BY articleId LIMIT 200',
        [cursor]
      );
      for (const row of rows)
        if (!(await canonicalArticle(runner.manager, row.articleId)))
          throw new Error('Missing article authority');
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1].articleId;
    }
    let receiptCursor: [string, string, string] = ['', '', ''];
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT * FROM article_commands WHERE (tenantId, actorIdentityId, commandKey) > (?, ?, ?) ORDER BY tenantId, actorIdentityId, commandKey LIMIT 200',
        receiptCursor
      );
      for (const row of rows) {
        const value = articleJson(row.receipt);
        const receipt =
          row.kind === 'draft'
            ? parseArticleReceipt(value)
            : row.kind === 'publication'
            ? parseArticlePublicationReceipt(value)
            : null;
        if (
          !receipt ||
          receipt.id !== row.articleId ||
          typeof row.fingerprint !== 'string' ||
          !/^[0-9a-f]{64}$/.test(row.fingerprint) ||
          !isEditorialScope(row.tenantId) ||
          !isEditorialScope(row.actorIdentityId) ||
          typeof row.commandKey !== 'string' ||
          !/^[A-Za-z0-9._:-]{1,128}$/.test(row.commandKey)
        )
          throw new Error('Invalid article receipt');
        articleTimestamp(Number(row.createdAt));
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
      `SELECT d.id FROM article_drafts d LEFT JOIN article_workspaces w ON w.tenantId = d.tenantId AND w.ownerIdentityId = d.ownerIdentityId WHERE w.ownerIdentityId IS NULL LIMIT 1`,
      'SELECT tenantId FROM article_drafts WHERE deletedAt IS NULL GROUP BY tenantId, ownerIdentityId HAVING COUNT(*) > 100 LIMIT 1',
      "SELECT articleId FROM article_submissions WHERE status = 'submitted' GROUP BY articleId HAVING COUNT(*) > 1 LIMIT 1",
      'SELECT s.articleId FROM article_submissions s LEFT JOIN article_drafts d ON d.id = s.articleId WHERE d.id IS NULL LIMIT 1',
      `SELECT s.articleId FROM article_submissions s LEFT JOIN editorial_resource_states e ON e.resourceKind = 'article' AND e.resourceId = s.articleId
       WHERE s.sourcePublicationRevision IS NOT NULL AND (e.resourceId IS NULL OR s.sourcePublicationRevision > e.revision) LIMIT 1`,
      `SELECT p.articleId FROM article_publications p LEFT JOIN article_drafts d ON d.id = p.articleId
       LEFT JOIN editorial_resource_states e ON e.resourceKind = 'article' AND e.resourceId = p.articleId
       WHERE p.ownerIdentityId IS NOT NULL AND (d.id IS NULL OR d.tenantId <> p.tenantId OR d.ownerIdentityId <> p.ownerIdentityId OR p.submittedRevision >= d.revision
       OR p.publishedAt < d.createdAt OR p.updatedAt > d.updatedAt OR (d.deletedAt IS NOT NULL AND e.deletedAt IS NULL)) LIMIT 1`,
      `SELECT p.articleId FROM article_publications p JOIN article_drafts d ON d.id = p.articleId
       LEFT JOIN article_submissions s ON s.articleId = p.articleId AND s.submittedRevision = p.submittedRevision
       WHERE p.ownerIdentityId IS NOT NULL AND d.deletedAt IS NULL AND (s.articleId IS NULL OR s.status <> 'approved' OR s.fields <> p.fields OR s.reviewedAt <> p.updatedAt) LIMIT 1`,
      "SELECT e.resourceId FROM editorial_resource_states e LEFT JOIN article_publications p ON p.articleId = e.resourceId WHERE e.resourceKind = 'article' AND p.articleId IS NULL LIMIT 1",
      `SELECT c.articleId FROM article_commands c LEFT JOIN article_drafts d ON d.id = c.articleId
       LEFT JOIN article_workspaces w ON w.tenantId = c.tenantId AND w.ownerIdentityId = c.actorIdentityId
       WHERE d.id IS NULL OR w.ownerIdentityId IS NULL OR c.tenantId <> d.tenantId OR JSON_EXTRACT(c.receipt, '$.revision') > d.revision
       OR c.createdAt < d.createdAt OR c.createdAt > d.updatedAt OR (JSON_EXTRACT(c.receipt, '$.deleted') = true AND d.deletedAt IS NULL)
       OR ((c.kind = 'draft' OR JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.action')) IN ('submit','withdraw')) AND c.actorIdentityId <> d.ownerIdentityId)
       OR (JSON_UNQUOTE(JSON_EXTRACT(c.receipt, '$.action')) IN ('approve','reject') AND c.actorIdentityId = d.ownerIdentityId) LIMIT 1`,
    ];
    for (const sql of checks)
      if ((await runner.query(sql)).length)
        throw new Error(
          'Invalid article authority, capacity or receipt relationships; repair explicitly'
        );
  }
  async down(): Promise<void> {
    throw new Error(
      'Article content, revisions and receipts are authoritative; use a reviewed data-preserving migration'
    );
  }
}
