import { TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm';

const indexes = [
  [
    'comment_likes',
    'idx_like_actor',
    ['actorIdentityId', 'commentId'],
    'uq_comment_actor',
    ['commentId', 'actorIdentityId'],
  ],
  [
    'discussion_votes',
    'idx_vote_actor',
    ['actorIdentityId', 'nodeId'],
    'PRIMARY',
    ['nodeId', 'actorIdentityId'],
  ],
  [
    'discussion_commands',
    'idx_discussion_command_actor',
    ['actorIdentityId', 'tenantId', 'commandKey'],
    'PRIMARY',
    ['tenantId', 'actorIdentityId', 'commandKey'],
  ],
] as const;

/** Actor-first indexes keep each private-data cleanup call bounded across tenants. */
export class DiscussionPrivateErasure1791840007000
  implements MigrationInterface
{
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
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
    for (const [
      tableName,
      name,
      columns,
      uniqueName,
      uniqueColumns,
    ] of indexes) {
      const table = await runner.getTable(tableName);
      const [meta]: { engine: string; collation: string }[] =
        await runner.query(
          "SELECT t.ENGINE AS engine,c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=? AND c.COLUMN_NAME='actorIdentityId'",
          [tableName]
        );
      const actor = table?.findColumnByName('actorIdentityId');
      const triggers: unknown[] = await runner.query(
        'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE=?',
        [tableName]
      );
      if (
        !table ||
        !actor ||
        actor.type !== 'varchar' ||
        actor.length !== '128' ||
        actor.isNullable ||
        actor.isGenerated ||
        table.foreignKeys.length ||
        triggers.length ||
        meta?.engine.toLowerCase() !== 'innodb' ||
        meta.collation !== 'utf8mb4_bin'
      )
        throw new Error(
          `Incompatible Discussion private erasure schema ${tableName}`
        );
      await this.validateIndex(runner, tableName, uniqueName, uniqueColumns, 0);
      if (!table.indices.some((index) => index.name === name)) {
        if (applied.length)
          throw new Error(
            `Applied Discussion private erasure index is missing: ${name}`
          );
        await runner.createIndex(
          tableName,
          new TableIndex({ name, columnNames: [...columns] })
        );
      }
      await this.validateIndex(runner, tableName, name, columns, 1);
    }
  }

  private async validateIndex(
    runner: QueryRunner,
    table: string,
    name: string,
    columns: readonly string[],
    nonUnique: number
  ): Promise<void> {
    const entries: {
      name: string;
      nonUnique: string | number;
      prefix: number | null;
      kind: string;
      visible: string;
      direction: string;
    }[] = await runner.query(
      'SELECT COLUMN_NAME AS name,NON_UNIQUE AS nonUnique,SUB_PART AS prefix,INDEX_TYPE AS kind,IS_VISIBLE AS visible,COLLATION AS direction FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? ORDER BY SEQ_IN_INDEX',
      [table, name]
    );
    if (
      entries.map((entry) => entry.name).join(',') !== columns.join(',') ||
      entries.some(
        (entry) =>
          Number(entry.nonUnique) !== nonUnique ||
          entry.prefix !== null ||
          entry.kind !== 'BTREE' ||
          entry.visible !== 'YES' ||
          entry.direction !== 'A'
      )
    )
      throw new Error(`Incompatible Discussion private erasure index ${name}`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Discussion erasure requires a reviewed data-preserving rollback'
    );
  }
}
