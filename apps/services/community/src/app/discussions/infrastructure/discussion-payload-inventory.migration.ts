import type { MigrationInterface, QueryRunner } from 'typeorm';
import { discussionInventoryProgress } from './mysql-discussion-payload-inventory';

const tableName = 'discussion_payload_inventory';
const columns = [
  ['id', 'tinyint', '', false, null],
  ['revision', 'bigint', '', false, null],
  ['afterKey', 'varchar', '160', false, 'ascii_bin'],
  ['completedAt', 'bigint', '', true, null],
  ['legacyWritersStoppedAt', 'bigint', '', true, null],
  ['lastPlanHash', 'char', '64', true, 'ascii_bin'],
] as const;

export class DiscussionPayloadInventory1791840005000
  implements MigrationInterface
{
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('discussion_payload_objects')))
      throw new Error('Payload inventory requires the ownership registry');
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const applied: unknown[] = (await runner.hasTable(history))
      ? await runner.query(
          `SELECT name FROM ${runner.connection.driver.escape(
            history
          )} WHERE name=?`,
          [this.constructor.name]
        )
      : [];
    if (!(await runner.hasTable(tableName))) {
      if (applied.length)
        throw new Error('Applied payload inventory table is missing');
      await runner.query(`CREATE TABLE discussion_payload_inventory (
        id tinyint UNSIGNED NOT NULL PRIMARY KEY,
        revision bigint UNSIGNED NOT NULL,
        afterKey varchar(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        completedAt bigint UNSIGNED NULL,
        legacyWritersStoppedAt bigint UNSIGNED NULL,
        lastPlanHash char(64) CHARACTER SET ascii COLLATE ascii_bin NULL
      ) ENGINE=InnoDB`);
    }
    const table = await runner.getTable(tableName);
    const info: { name: string; engine: string; collation: string | null }[] =
      await runner.query(
        'SELECT c.COLUMN_NAME AS name, t.ENGINE AS engine, c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=?',
        [tableName]
      );
    const triggers: unknown[] = await runner.query(
      'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE=?',
      [tableName]
    );
    const indexes: {
      name: string;
      columns: string;
      prefix: number | null;
      nonUnique: number | string;
    }[] = await runner.query(
      'SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns, MAX(SUB_PART) AS prefix, MIN(NON_UNIQUE) AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? GROUP BY INDEX_NAME',
      [tableName]
    );
    if (
      !table ||
      table.columns.length !== columns.length ||
      table.foreignKeys.length ||
      triggers.length ||
      table.primaryColumns.map((column) => column.name).join(',') !== 'id' ||
      indexes.length !== 1 ||
      indexes[0].name !== 'PRIMARY' ||
      indexes[0].columns !== 'id' ||
      indexes[0].prefix !== null ||
      Number(indexes[0].nonUnique) !== 0
    )
      throw new Error('Incompatible payload inventory schema');
    for (const [name, type, length, nullable, collation] of columns) {
      const column = table.columns.find((value) => value.name === name);
      const meta = info.find((value) => value.name === name);
      if (
        !column ||
        column.type !== type ||
        column.length !== length ||
        column.isNullable !== nullable ||
        column.isGenerated ||
        meta?.engine.toLowerCase() !== 'innodb' ||
        meta.collation !== collation ||
        (collation === null && !column.unsigned)
      )
        throw new Error(`Incompatible payload inventory ${name}`);
    }
    let rows: Record<string, unknown>[] = await runner.query(
      'SELECT * FROM discussion_payload_inventory'
    );
    if (!rows.length) {
      if (applied.length)
        throw new Error('Applied payload inventory checkpoint is missing');
      await runner.query(
        "INSERT INTO discussion_payload_inventory (id, revision, afterKey, completedAt, legacyWritersStoppedAt, lastPlanHash) VALUES (1, 1, '', NULL, NULL, NULL)"
      );
      rows = await runner.query('SELECT * FROM discussion_payload_inventory');
    }
    if (rows.length !== 1)
      throw new Error('Inconsistent payload inventory checkpoints');
    discussionInventoryProgress(rows[0]);
  }
  async down(): Promise<void> {
    throw new Error(
      'Payload inventory progress and retirement markers require a reviewed data-preserving rollback'
    );
  }
}
