import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscussionPins1791676826000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    const name = 'discussion_write_aggregates';
    const table = await runner.getTable(name);
    if (!table) throw new Error('Discussion aggregate authority is missing');
    const completed = (await runner.hasTable('migrations'))
      ? await runner.query('SELECT id FROM migrations WHERE name = ?', [
          this.constructor.name,
        ])
      : [];
    if (!table.findColumnByName('pinned')) {
      if (completed.length)
        throw new Error('Completed discussion pin column is missing');
      await runner.query(`ALTER TABLE discussion_write_aggregates
        ADD COLUMN pinned tinyint unsigned NOT NULL DEFAULT 0`);
    }
    const columns: Array<{
      type: string;
      nullable: string;
      initial: string | number;
      engine: string;
    }> = await runner.query(
      `SELECT c.COLUMN_TYPE AS type, c.IS_NULLABLE AS nullable,
        c.COLUMN_DEFAULT AS initial, t.ENGINE AS engine FROM information_schema.COLUMNS c
        JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
        WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = ? AND c.COLUMN_NAME = 'pinned'`,
      [name]
    );
    if (
      columns.length !== 1 ||
      columns[0].type !== 'tinyint unsigned' ||
      columns[0].nullable !== 'NO' ||
      String(columns[0].initial) !== '0' ||
      columns[0].engine !== 'InnoDB'
    )
      throw new Error('Incompatible discussion pin column');
    const checks: Array<{ clause: string; enforced: string }> =
      await runner.query(
        `SELECT c.CHECK_CLAUSE AS clause, t.ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS t
       JOIN information_schema.CHECK_CONSTRAINTS c ON c.CONSTRAINT_SCHEMA = t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME = t.CONSTRAINT_NAME
       WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = ? AND t.CONSTRAINT_NAME = 'ck_discussion_pinned'`,
        [name]
      );
    if (!checks.length) {
      if (completed.length)
        throw new Error('Completed discussion pin constraint is missing');
      await runner.query(
        'ALTER TABLE discussion_write_aggregates ADD CONSTRAINT ck_discussion_pinned CHECK (pinned IN (0, 1))'
      );
    } else if (
      checks.length !== 1 ||
      checks[0].enforced !== 'YES' ||
      checks[0].clause.toLowerCase().replace(/[()`\s]/g, '') !== 'pinnedin0,1'
    )
      throw new Error('Incompatible discussion pin constraint');
    const index = 'idx_discussion_pinned_target';
    let keys: Array<{
      name: string;
      direction: string;
      nonUnique: string | number;
      prefix: number | null;
    }> = await runner.query(
      `SELECT COLUMN_NAME AS name, COLLATION AS direction, NON_UNIQUE AS nonUnique, SUB_PART AS prefix
        FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        AND INDEX_NAME = ? ORDER BY SEQ_IN_INDEX`,
      [name, index]
    );
    if (!keys.length) {
      if (completed.length)
        throw new Error('Completed discussion pin index is missing');
      await runner.query(`CREATE INDEX idx_discussion_pinned_target ON discussion_write_aggregates
        (tenantId, subjectKind, subjectId, pinned DESC, createdAt DESC, id)`);
      keys = await runner.query(
        `SELECT COLUMN_NAME AS name, COLLATION AS direction, NON_UNIQUE AS nonUnique, SUB_PART AS prefix
        FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        AND INDEX_NAME = ? ORDER BY SEQ_IN_INDEX`,
        [name, index]
      );
    }
    if (
      keys.map((key) => `${key.name}:${key.direction}`).join(',') !==
        'tenantId:A,subjectKind:A,subjectId:A,pinned:D,createdAt:D,id:A' ||
      keys.some((key) => Number(key.nonUnique) !== 1 || key.prefix !== null)
    )
      throw new Error('Incompatible discussion pin index');
    const invalid =
      await runner.query(`SELECT id FROM discussion_write_aggregates
      WHERE pinned NOT IN (0, 1) OR (pinned = 1 AND (subjectKind IS NULL OR subjectKind <> 'application')) LIMIT 1`);
    if (invalid.length)
      throw new Error('Invalid authoritative discussion pin state');
  }

  async down(): Promise<void> {
    throw new Error(
      'Use a reviewed data-preserving forward migration for discussion pins'
    );
  }
}
