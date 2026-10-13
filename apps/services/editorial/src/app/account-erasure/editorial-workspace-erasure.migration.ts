import type { MigrationInterface, QueryRunner } from 'typeorm';
import { editorialWorkspaceFamilies } from './editorial-workspace-erasure.tables';

type Index = { table: string; name: string; columns: string[] };
const name = 'EditorialWorkspaceErasure1791840012000';
const indexes: Index[] = editorialWorkspaceFamilies.flatMap((family) => [
  {
    table: family.drafts,
    name: 'idx_erasure_owner',
    columns: ['ownerIdentityId', 'id'],
  },
  {
    table: family.drafts,
    name: 'idx_erasure_live',
    columns: ['ownerIdentityId', 'deletedAt', 'id'],
  },
  {
    table: family.workspace,
    name: 'idx_erasure_owner',
    columns: ['ownerIdentityId', 'tenantId'],
  },
  ...family.commands.flatMap(([table, parent, actor]) => [
    {
      table,
      name: 'idx_erasure_parent',
      columns: [parent, 'tenantId', actor, 'commandKey'],
    },
    {
      table,
      name: 'idx_erasure_actor',
      columns: [actor, 'tenantId', 'commandKey'],
    },
  ]),
]);
for (const table of ['application_image_uploads', 'article_cover_uploads'])
  indexes.push({
    table,
    name: 'idx_erasure_owner',
    columns: ['ownerIdentityId', 'id'],
  });
for (const table of ['application_image_commands', 'article_cover_commands'])
  indexes.push({
    table,
    name: 'idx_erasure_owner',
    columns: ['ownerIdentityId', 'tenantId', 'commandKey'],
  });

/** Index-only: private cleanup never changes canonical publications or their revisions. */
export class EditorialWorkspaceErasure1791840012000
  implements MigrationInterface
{
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const applied =
      (await runner.hasTable('editorial_migrations')) &&
      (
        await runner.query(
          'SELECT name FROM editorial_migrations WHERE name=? LIMIT 1',
          [name]
        )
      ).length > 0;
    const missing: Index[] = [];
    // Validate every table and existing index before the first implicitly committed DDL statement.
    for (const index of indexes) {
      const info: Record<string, unknown>[] = await runner.query(
        'SELECT t.ENGINE AS engine,c.COLUMN_NAME AS name,c.DATA_TYPE AS type,c.COLUMN_TYPE AS sqlType,c.CHARACTER_MAXIMUM_LENGTH AS length,c.COLLATION_NAME AS collation,c.IS_NULLABLE AS nullable FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=?',
        [index.table]
      );
      for (const column of index.columns) {
        const value = info.find((value) => value.name === column);
        if (column === 'deletedAt') {
          if (
            !value ||
            value.engine !== 'InnoDB' ||
            value.type !== 'bigint' ||
            value.sqlType !== 'bigint unsigned' ||
            value.nullable !== 'YES'
          )
            throw new Error(
              `Incompatible Editorial workspace erasure lifecycle: ${index.table}.${column}`
            );
          continue;
        }
        if (
          !value ||
          value.engine !== 'InnoDB' ||
          value.type !== 'varchar' ||
          value.collation !== 'utf8mb4_bin' ||
          value.nullable !== 'NO' ||
          Number(value.length) !==
            ([
              'id',
              'draftId',
              'applicationId',
              'suiteId',
              'articleId',
            ].includes(column)
              ? 36
              : 128)
        )
          throw new Error(
            `Incompatible Editorial workspace erasure authority: ${index.table}.${column}`
          );
      }
      if (!(await this.index(runner, index, !applied))) missing.push(index);
    }
    for (const index of missing)
      await runner.query(
        `CREATE INDEX ${index.name} ON ${index.table} (${index.columns.join(
          ','
        )})`
      );
    for (const index of indexes) await this.index(runner, index, false);
  }

  private async index(
    runner: QueryRunner,
    index: Index,
    allowMissing: boolean
  ) {
    const rows: Record<string, unknown>[] = await runner.query(
      'SELECT COLUMN_NAME AS name,SUB_PART AS prefix,NON_UNIQUE AS nonUnique,COLLATION AS direction,IS_VISIBLE AS visible,EXPRESSION AS expression FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX',
      [index.table, index.name]
    );
    if (!rows.length && allowMissing) return false;
    if (
      rows.length !== index.columns.length ||
      rows.some(
        (row, i) =>
          row.name !== index.columns[i] ||
          row.prefix !== null ||
          Number(row.nonUnique) !== 1 ||
          row.direction !== 'A' ||
          row.visible !== 'YES' ||
          row.expression !== null
      )
    )
      throw new Error(
        `Incompatible Editorial workspace erasure index: ${index.table}.${index.name}`
      );
    return true;
  }

  async down(): Promise<void> {
    throw new Error(
      'Editorial workspace erasure requires a reviewed data-preserving rollback'
    );
  }
}
