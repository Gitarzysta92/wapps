import { TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm';

export class DiscussionParticipation1791676824000
  implements MigrationInterface
{
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const name = 'discussion_write_nodes',
      indexName = 'idx_discussion_participant';
    const table = await runner.getTable(name);
    if (!table) throw new Error('Discussion node authority is missing');
    const owner = table.findColumnByName('ownerIdentityId');
    const historyTable =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const anonymousOwners: unknown[] =
      owner?.isNullable && (await runner.hasTable(historyTable))
        ? await runner.query(
            `SELECT name FROM ${runner.connection.driver.escape(
              historyTable
            )} WHERE name=?`,
            ['DiscussionAuthorErasure1791840006000']
          )
        : [];
    if (
      !owner ||
      owner.type !== 'varchar' ||
      owner.length !== '128' ||
      (owner.isNullable && !anonymousOwners.length)
    )
      throw new Error('Incompatible discussion participant schema');
    const schema: Array<{ ENGINE: string; COLLATION_NAME: string }> =
      await runner.query(
        `SELECT t.ENGINE, c.COLLATION_NAME FROM information_schema.TABLES t
       JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME
       WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = ? AND c.COLUMN_NAME = 'ownerIdentityId'`,
        [name]
      );
    if (
      schema.length !== 1 ||
      schema[0].ENGINE !== 'InnoDB' ||
      schema[0].COLLATION_NAME !== 'utf8mb4_bin'
    )
      throw new Error(
        'Discussion participation requires binary transactional ownership'
      );
    if (!table.indices.some((index) => index.name === indexName)) {
      const history = (await runner.hasTable('migrations'))
        ? await runner.query('SELECT id FROM migrations WHERE name = ?', [
            this.constructor.name,
          ])
        : [];
      if (history.length)
        throw new Error('Completed discussion participant index is missing');
      await runner.createIndex(
        name,
        new TableIndex({
          name: indexName,
          columnNames: ['ownerIdentityId', 'discussionId', 'nodeId'],
        })
      );
    }
    const columns: Array<{
      name: string;
      nonUnique: string | number;
      prefixLength: number | null;
    }> = await runner.query(
      `SELECT COLUMN_NAME AS name, NON_UNIQUE AS nonUnique, SUB_PART AS prefixLength
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         AND INDEX_NAME = ? ORDER BY SEQ_IN_INDEX`,
      [name, indexName]
    );
    if (
      columns.map((entry) => entry.name).join(',') !==
        'ownerIdentityId,discussionId,nodeId' ||
      columns.some(
        (entry) => Number(entry.nonUnique) !== 1 || entry.prefixLength !== null
      )
    )
      throw new Error('Incompatible discussion participant index');
  }

  async down(): Promise<void> {
    throw new Error(
      'Use a reviewed forward migration for the discussion participation index'
    );
  }
}
