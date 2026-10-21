import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscussionVotes1791676825000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const name = 'discussion_votes';
    if (!(await runner.hasTable(name))) {
      const completed = (await runner.hasTable('migrations'))
        ? await runner.query('SELECT id FROM migrations WHERE name = ?', [
            this.constructor.name,
          ])
        : [];
      if (completed.length)
        throw new Error('Completed discussion vote schema is missing');
      await runner.query(`CREATE TABLE discussion_votes (
        nodeId varchar(36) NOT NULL,
        actorIdentityId varchar(128) NOT NULL,
        value tinyint NOT NULL,
        createdAt bigint unsigned NOT NULL,
        updatedAt bigint unsigned NOT NULL,
        PRIMARY KEY (nodeId, actorIdentityId),
        CONSTRAINT ck_discussion_vote_value CHECK (value IN (-1, 1))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    }
    const columns: Array<{
      name: string;
      type: string;
      nullable: string;
      collation: string | null;
      engine: string;
    }> = await runner.query(
      `SELECT c.COLUMN_NAME AS name, c.COLUMN_TYPE AS type, c.IS_NULLABLE AS nullable,
       c.COLLATION_NAME AS collation, t.ENGINE AS engine FROM information_schema.COLUMNS c
       JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
       WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = ? ORDER BY c.ORDINAL_POSITION`,
      [name]
    );
    const expected = [
      'nodeId:varchar(36)',
      'actorIdentityId:varchar(128)',
      'value:tinyint',
      'createdAt:bigint unsigned',
      'updatedAt:bigint unsigned',
    ];
    if (
      columns.map((column) => `${column.name}:${column.type}`).join(',') !==
        expected.join(',') ||
      columns.some(
        (column) =>
          column.nullable !== 'NO' ||
          column.engine !== 'InnoDB' ||
          (column.type.startsWith('varchar') &&
            column.collation !== 'utf8mb4_bin')
      )
    )
      throw new Error('Incompatible discussion vote columns');
    const keys: Array<{
      name: string;
      nonUnique: string | number;
      prefix: number | null;
    }> = await runner.query(
      `SELECT COLUMN_NAME AS name, NON_UNIQUE AS nonUnique, SUB_PART AS prefix
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       AND INDEX_NAME = 'PRIMARY' ORDER BY SEQ_IN_INDEX`,
      [name]
    );
    if (
      keys.map((key) => key.name).join(',') !== 'nodeId,actorIdentityId' ||
      keys.some((key) => Number(key.nonUnique) !== 0 || key.prefix !== null)
    )
      throw new Error('Incompatible discussion vote identity key');
    const checks: Array<{ clause: string; enforced: string }> =
      await runner.query(
        `SELECT c.CHECK_CLAUSE AS clause, t.ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS t
       JOIN information_schema.CHECK_CONSTRAINTS c ON c.CONSTRAINT_SCHEMA = t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = t.CONSTRAINT_NAME
       WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = ? AND t.CONSTRAINT_NAME = 'ck_discussion_vote_value'`,
        [name]
      );
    if (
      checks.length !== 1 ||
      checks[0].enforced !== 'YES' ||
      checks[0].clause.toLowerCase().replace(/[()`\s]/g, '') !== 'valuein-1,1'
    )
      throw new Error('Incompatible discussion vote value constraint');
    const invalid = await runner.query(`SELECT v.nodeId FROM discussion_votes v
      LEFT JOIN discussion_write_nodes n ON n.nodeId = v.nodeId
      LEFT JOIN discussion_write_aggregates a ON a.id = n.discussionId
      WHERE n.nodeId IS NULL OR a.id IS NULL OR a.subjectKind IS NULL OR a.subjectKind <> 'application'
      OR v.value NOT IN (-1, 1) OR v.actorIdentityId = '' OR v.actorIdentityId <> TRIM(v.actorIdentityId)
      OR v.createdAt < 1 OR v.updatedAt < v.createdAt LIMIT 1`);
    if (invalid.length)
      throw new Error('Invalid authoritative discussion votes');
  }

  async down(): Promise<void> {
    throw new Error(
      'Use a reviewed data-preserving forward migration for discussion votes'
    );
  }
}
