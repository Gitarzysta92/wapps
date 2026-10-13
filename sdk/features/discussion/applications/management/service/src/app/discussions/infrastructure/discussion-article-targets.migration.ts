import {
  TableColumn,
  TableIndex,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';
import { publicCommentId } from '@sdk/features/discussion/core';

export class DiscussionArticleTargets1791676822000
  implements MigrationInterface
{
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const name = 'discussion_write_aggregates';
    const history = (await runner.hasTable('migrations'))
      ? await runner.query('SELECT id FROM migrations WHERE name = ?', [
          this.constructor.name,
        ])
      : [];
    let table = await runner.getTable(name);
    if (!table) throw new Error('Discussion write authority is missing');
    if (!table.findColumnByName('subjectKind')) {
      if (history.length)
        throw new Error('Completed discussion target column is missing');
      await runner.addColumn(
        name,
        new TableColumn({
          name: 'subjectKind',
          type: 'varchar',
          length: '16',
          isNullable: true,
          charset: 'utf8mb4',
          collation: 'utf8mb4_bin',
        })
      );
    }
    table = await runner.getTable(name);
    if (!table) throw new Error('Discussion write authority is missing');
    if (
      !table.indices.some(
        (index) => index.name === 'idx_discussion_article_page'
      )
    ) {
      if (history.length)
        throw new Error('Completed discussion target index is missing');
      await runner.createIndex(
        name,
        new TableIndex({
          name: 'idx_discussion_article_page',
          columnNames: [
            'tenantId',
            'subjectKind',
            'subjectId',
            'createdAt',
            'id',
          ],
        })
      );
    }
    table = await runner.getTable(name);
    const column = table?.findColumnByName('subjectKind');
    if (
      !table ||
      !column ||
      column.type !== 'varchar' ||
      column.length !== '16' ||
      !column.isNullable
    )
      throw new Error('Incompatible discussion target schema');
    // TypeORM's MySQL index introspection does not order columns by SEQ_IN_INDEX.
    const indexColumns: {
      name: string;
      nonUnique: string | number;
      prefixLength: number | null;
    }[] = await runner.query(
      `SELECT COLUMN_NAME AS name, NON_UNIQUE AS nonUnique, SUB_PART AS prefixLength
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         AND INDEX_NAME = 'idx_discussion_article_page' ORDER BY SEQ_IN_INDEX`,
      [name]
    );
    if (
      indexColumns.map((entry) => entry.name).join(',') !==
        'tenantId,subjectKind,subjectId,createdAt,id' ||
      indexColumns.some(
        (entry) => Number(entry.nonUnique) !== 1 || entry.prefixLength !== null
      )
    )
      throw new Error('Incompatible discussion target index');
    const schema = await runner.query(
      `SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [name]
    );
    const columns = await runner.query(
      `SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN ('tenantId', 'subjectKind')`,
      [name]
    );
    if (
      schema.length !== 1 ||
      schema[0].ENGINE !== 'InnoDB' ||
      columns.length !== 2 ||
      columns.some(
        (value: { COLLATION_NAME: string }) =>
          value.COLLATION_NAME !== 'utf8mb4_bin'
      )
    )
      throw new Error(
        'Discussion targets require binary transactional storage'
      );
    const invalid =
      await runner.query(`SELECT a.id FROM discussion_write_aggregates a
      LEFT JOIN discussion_write_nodes m ON m.nodeId = a.id
      LEFT JOIN content_nodes n ON n.id = a.id
      WHERE a.subjectKind IS NOT NULL AND (a.subjectKind NOT IN ('article', 'application') OR a.subjectId IS NULL
        OR m.nodeId IS NULL OR n.id IS NULL OR n.kind <> 'discussion' OR m.discussionId <> a.id
        OR n.state <> 'published' OR n.visibility <> 'public'
        OR a.createdAt < 0 OR a.createdAt > 9007199254740991
        OR BINARY TRIM(a.tenantId) <> BINARY a.tenantId OR a.tenantId = '') LIMIT 1`);
    if (invalid.length)
      throw new Error('Inconsistent discussion article target authority');
    let after = '';
    for (;;) {
      const rows = await runner.query(
        `SELECT id, subjectId FROM ${name} WHERE subjectKind IS NOT NULL AND id > ? ORDER BY id LIMIT 200`,
        [after]
      );
      for (const row of rows) {
        publicCommentId(row.id);
        publicCommentId(row.subjectId);
      }
      if (rows.length < 200) break;
      after = rows[rows.length - 1].id;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Discussion article targets are authoritative; use a reviewed forward migration'
    );
  }
}
