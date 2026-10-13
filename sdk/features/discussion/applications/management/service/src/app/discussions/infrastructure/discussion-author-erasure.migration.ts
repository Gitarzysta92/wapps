import type { MigrationInterface, QueryRunner } from 'typeorm';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import { publicCommentId } from '@sdk/features/discussion/core';

const tableName = 'discussion_erasure_nodes';
const columns = [
  ['identityId', 'varchar', '128', 'utf8mb4_bin'],
  ['erasureRevision', 'bigint', '', null],
  ['nodeId', 'char', '36', 'ascii_bin'],
  ['discussionId', 'char', '36', 'ascii_bin'],
  ['projectionRevision', 'bigint', '', null],
] as const;

/** Retain cleanup targets until obsolete objects, projections and attribution are gone. */
export class DiscussionAuthorErasure1791840006000
  implements MigrationInterface
{
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    for (const name of [
      'discussion_write_nodes',
      'discussion_payload_objects',
      'discussion_payload_inventory',
      'identity_erasure_requests',
    ])
      if (!(await runner.hasTable(name)))
        throw new Error(`Discussion author erasure requires ${name}`);
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
        throw new Error('Applied Discussion erasure targets are missing');
      await runner.query(`CREATE TABLE discussion_erasure_nodes (
        identityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        erasureRevision bigint UNSIGNED NOT NULL,
        nodeId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        discussionId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        projectionRevision bigint UNSIGNED NOT NULL,
        PRIMARY KEY (identityId,nodeId), UNIQUE KEY idx_erasure_node (nodeId)
      ) ENGINE=InnoDB`);
    }
    const table = await runner.getTable(tableName);
    const info: { name: string; engine: string; collation: string | null }[] =
      await runner.query(
        'SELECT c.COLUMN_NAME AS name,t.ENGINE AS engine,c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=?',
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
      nonUnique: string | number;
    }[] = await runner.query(
      'SELECT INDEX_NAME AS name,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns,MAX(SUB_PART) AS prefix,MIN(NON_UNIQUE) AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? GROUP BY INDEX_NAME',
      [tableName]
    );
    if (
      !table ||
      table.columns.length !== columns.length ||
      table.foreignKeys.length ||
      triggers.length ||
      table.primaryColumns.map((column) => column.name).join(',') !==
        'identityId,nodeId' ||
      indexes.length !== 2 ||
      ![
        ['PRIMARY', 'identityId,nodeId'],
        ['idx_erasure_node', 'nodeId'],
      ].every(([name, names]) =>
        indexes.some(
          (index) =>
            index.name === name &&
            index.columns === names &&
            index.prefix === null &&
            Number(index.nonUnique) === 0
        )
      )
    )
      throw new Error('Incompatible Discussion erasure targets schema');
    for (const [name, type, length, collation] of columns) {
      const column = table.findColumnByName(name),
        meta = info.find((entry) => entry.name === name);
      if (
        !column ||
        column.type !== type ||
        column.length !== length ||
        column.isNullable ||
        column.isGenerated ||
        meta?.engine.toLowerCase() !== 'innodb' ||
        meta.collation !== collation ||
        (collation === null && !column.unsigned)
      )
        throw new Error(`Incompatible Discussion erasure targets ${name}`);
    }
    for (const name of [
      'discussion_write_nodes',
      'discussion_payload_objects',
    ]) {
      const owner = (await runner.getTable(name))?.findColumnByName(
        'ownerIdentityId'
      );
      const [meta]: { engine: string; collation: string }[] =
        await runner.query(
          "SELECT t.ENGINE AS engine,c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=? AND c.COLUMN_NAME='ownerIdentityId'",
          [name]
        );
      if (
        !owner ||
        owner.type !== 'varchar' ||
        owner.length !== '128' ||
        owner.isGenerated ||
        meta?.engine.toLowerCase() !== 'innodb' ||
        meta.collation !== 'utf8mb4_bin'
      )
        throw new Error(`Incompatible Discussion erasure ownership in ${name}`);
      if (!owner.isNullable) {
        if (applied.length)
          throw new Error(
            `Applied Discussion anonymous ownership is missing in ${name}`
          );
        await runner.query(
          `ALTER TABLE ${runner.connection.driver.escape(
            name
          )} MODIFY ownerIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL`
        );
      }
    }
    let after: string | null = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        `SELECT e.*,n.ownerIdentityId,n.discussionId canonicalDiscussionId,a.revision,b.erasureRevision barrierRevision,r.revision requestRevision,r.completedAt
        FROM discussion_erasure_nodes e LEFT JOIN discussion_write_nodes n ON n.nodeId=e.nodeId
        LEFT JOIN discussion_write_aggregates a ON a.id=e.discussionId
        LEFT JOIN identity_erasure_barriers b ON b.identityId=e.identityId
        LEFT JOIN identity_erasure_requests r ON r.identityId=e.identityId
        WHERE (? IS NULL OR e.nodeId>?) ORDER BY e.nodeId LIMIT 256`,
        [after, after]
      );
      for (const row of rows) {
        const erasureRevision = Number(row.erasureRevision),
          projectionRevision = Number(row.projectionRevision);
        if (
          !isCanonicalIdentityId(row.identityId) ||
          !Number.isSafeInteger(erasureRevision) ||
          erasureRevision < 1 ||
          !Number.isSafeInteger(projectionRevision) ||
          projectionRevision < 2 ||
          row.ownerIdentityId !== null ||
          row.canonicalDiscussionId !== row.discussionId ||
          !Number.isSafeInteger(Number(row.revision)) ||
          Number(row.revision) < projectionRevision ||
          Number(row.barrierRevision) !== erasureRevision ||
          Number(row.requestRevision) !== erasureRevision ||
          row.completedAt !== null
        )
          throw new Error('Invalid Discussion erasure target authority');
        after = publicCommentId(row.nodeId);
        publicCommentId(row.discussionId);
      }
      if (rows.length < 256) break;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Discussion anonymity and cleanup targets require a reviewed data-preserving rollback'
    );
  }
}
