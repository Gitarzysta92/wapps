import type { MigrationInterface, QueryRunner } from 'typeorm';

const migration = 'EditorialErasureCompletion1791840014000';
const tables = [
  ['application_submissions', false],
  ['suite_submissions', false],
  ['article_publications', true],
] as const;

/** Index the copied author attribution independently of its parent lifecycle. */
export class EditorialErasureCompletion1791840014000
  implements MigrationInterface
{
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    const applied =
      (await runner.hasTable('editorial_migrations')) &&
      (
        await runner.query(
          'SELECT name FROM editorial_migrations WHERE name=? LIMIT 1',
          [migration]
        )
      ).length > 0;
    const missing: string[] = [];
    for (const [table, nullable] of tables) {
      const [column]: Record<string, unknown>[] = await runner.query(
        'SELECT t.ENGINE AS engine,c.DATA_TYPE AS type,c.CHARACTER_MAXIMUM_LENGTH AS length,c.COLLATION_NAME AS collation,c.IS_NULLABLE AS nullable,c.COLUMN_DEFAULT AS defaultValue,c.EXTRA AS extra,c.GENERATION_EXPRESSION AS expression FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=? AND c.COLUMN_NAME=?',
        [table, 'ownerIdentityId']
      );
      if (
        !column ||
        column.engine !== 'InnoDB' ||
        column.type !== 'varchar' ||
        Number(column.length) !== 128 ||
        column.collation !== 'utf8mb4_bin' ||
        column.nullable !== (nullable ? 'YES' : 'NO') ||
        column.defaultValue !== null ||
        column.extra !== '' ||
        column.expression !== ''
      )
        throw new Error(
          `Incompatible Editorial completion attribution: ${table}`
        );
      if (!(await this.index(runner, table, !applied))) missing.push(table);
    }
    for (const table of missing)
      await runner.query(
        `CREATE INDEX idx_erasure_author ON ${table} (ownerIdentityId)`
      );
    for (const [table] of tables) await this.index(runner, table, false);
  }

  private async index(
    runner: QueryRunner,
    table: string,
    allowMissing: boolean
  ) {
    const rows: Record<string, unknown>[] = await runner.query(
      'SELECT COLUMN_NAME AS name,SUB_PART AS prefix,NON_UNIQUE AS nonUnique,COLLATION AS direction,IS_VISIBLE AS visible,EXPRESSION AS expression FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX',
      [table, 'idx_erasure_author']
    );
    if (!rows.length && allowMissing) return false;
    if (
      rows.length !== 1 ||
      rows[0].name !== 'ownerIdentityId' ||
      rows[0].prefix !== null ||
      Number(rows[0].nonUnique) !== 1 ||
      rows[0].direction !== 'A' ||
      rows[0].visible !== 'YES' ||
      rows[0].expression !== null
    )
      throw new Error(`Incompatible Editorial completion index: ${table}`);
    return true;
  }

  async down(): Promise<void> {
    throw new Error(
      'Editorial erasure completion requires a reviewed data-preserving rollback'
    );
  }
}
