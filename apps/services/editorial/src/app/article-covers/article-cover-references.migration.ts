import { Table, type MigrationInterface, type QueryRunner } from 'typeorm';
import { editorialMediaAssetsApplied } from '../application-media/editorial-media-assets';

export class ArticleCoverReferences1791676820000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner) {
    const registry = await editorialMediaAssetsApplied(runner);
    const table = new Table({
      name: 'article_cover_references',
      engine: 'InnoDB',
      columns: [
        {
          name: 'articleId',
          type: 'varchar',
          length: '36',
          isPrimary: true,
          charset: 'utf8mb4',
          collation: 'utf8mb4_bin',
        },
        {
          name: 'kind',
          type: 'varchar',
          length: '11',
          isPrimary: true,
          charset: 'utf8mb4',
          collation: 'utf8mb4_bin',
        },
        {
          name: 'imageId',
          type: 'varchar',
          length: '36',
          charset: 'utf8mb4',
          collation: 'utf8mb4_bin',
        },
      ],
      indices: [
        { name: 'idx_article_cover_reference_image', columnNames: ['imageId'] },
      ],
    });
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const completed =
      (await runner.hasTable(history)) &&
      (
        await runner.query(
          `SELECT id FROM ${runner.connection.driver.escape(
            history
          )} WHERE name = ?`,
          ['ArticleCoverReferences1791676820000']
        )
      ).length > 0;
    if (await runner.hasTable(table.name))
      await this.assertSchema(runner, table);
    else {
      if (completed)
        throw new Error('Completed article cover references are missing');
      await runner.createTable(table);
    }
    await this.validateReferences(runner, registry);
  }
  async validateReferences(runner: QueryRunner, registry: boolean) {
    const sources = [
      {
        kind: 'draft',
        sql: 'SELECT id AS articleId, fields FROM article_drafts WHERE deletedAt IS NULL',
      },
      {
        kind: 'submission',
        sql: 'SELECT s.articleId, s.fields FROM article_submissions s WHERE NOT EXISTS (SELECT 1 FROM article_submissions later WHERE later.articleId = s.articleId AND later.submittedRevision > s.submittedRevision)',
      },
      {
        kind: 'publication',
        sql: 'SELECT articleId, fields FROM article_publications',
      },
    ];
    const invalid = registry
      ? await runner.query(`SELECT r.imageId FROM article_cover_references r
      LEFT JOIN editorial_media_assets a ON a.kind='article' AND a.imageId=r.imageId
      LEFT JOIN article_cover_uploads i ON i.id=r.imageId
      LEFT JOIN article_drafts d ON d.id=r.articleId
      LEFT JOIN article_publications p ON p.articleId=r.articleId
      WHERE a.imageId IS NULL OR a.articleId <> r.articleId OR a.retiredAt IS NOT NULL OR a.asset IS NULL
      OR (r.kind='publication' AND (p.articleId IS NULL OR a.tenantId <> p.tenantId))
      OR (r.kind<>'publication' AND (d.id IS NULL OR i.id IS NULL OR i.articleId <> r.articleId OR i.tenantId <> d.tenantId OR a.tenantId <> d.tenantId OR i.ownerIdentityId <> d.ownerIdentityId OR i.status <> 'ready'))
      OR r.kind NOT IN ('draft','submission','publication') LIMIT 1`)
      : await runner.query(`SELECT r.imageId FROM article_cover_references r
      LEFT JOIN article_cover_uploads i ON i.id = r.imageId
      LEFT JOIN article_drafts d ON d.id = r.articleId
      WHERE i.id IS NULL OR d.id IS NULL OR i.articleId <> r.articleId OR i.tenantId <> d.tenantId
      OR i.ownerIdentityId <> d.ownerIdentityId OR i.status <> 'ready' OR i.asset IS NULL
      OR r.kind NOT IN ('draft', 'submission', 'publication') LIMIT 1`);
    if (invalid.length)
      throw new Error('Invalid article cover ownership or ready reference');
    for (const source of sources) {
      // Qualification/recovery validates both directions; never manufacture a reference from a disposable projection.
      const field = "JSON_UNQUOTE(JSON_EXTRACT(s.fields, '$.cover.imageId'))";
      const mismatch = await runner.query(
        `SELECT r.articleId FROM article_cover_references r
        LEFT JOIN (${source.sql}) s ON s.articleId = r.articleId
        WHERE r.kind = ? AND (s.articleId IS NULL OR ${field} IS NULL OR ${field} <> r.imageId) LIMIT 1`,
        [source.kind]
      );
      const missing = await runner.query(
        `SELECT s.articleId FROM (${source.sql}) s
        LEFT JOIN article_cover_references r ON r.articleId = s.articleId AND r.kind = ?
        WHERE ${field} IS NOT NULL AND (r.imageId IS NULL OR r.imageId <> ${field}) LIMIT 1`,
        [source.kind]
      );
      if (mismatch.length || missing.length)
        throw new Error(
          'Article cover references disagree with authoritative content'
        );
    }
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
  async down(): Promise<void> {
    throw new Error(
      'Article cover references protect authoritative bytes; use a reviewed data-preserving migration'
    );
  }
}
