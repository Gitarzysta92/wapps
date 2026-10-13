import { TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm';
import { registeredDiscussionPayload } from './mysql-discussion-payloads';

const tableName = 'discussion_payload_objects';
const columns = [
  ['objectKey', 'varchar', '160', false, 'ascii_bin'],
  ['nodeId', 'char', '36', false, 'ascii_bin'],
  ['ownerIdentityId', 'varchar', '128', false, 'utf8mb4_bin'],
  ['actorIdentityId', 'varchar', '128', true, 'utf8mb4_bin'],
  ['tenantId', 'varchar', '128', false, 'utf8mb4_bin'],
  ['sha256', 'char', '64', false, 'ascii_bin'],
  ['bytes', 'int', '', false, null],
  ['state', 'varchar', '16', false, 'ascii_bin'],
  ['registeredAt', 'bigint', '', false, null],
  ['retiredAt', 'bigint', '', true, null],
] as const;

export class DiscussionPayloads1791840004000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    for (const name of [
      'discussion_write_nodes',
      'discussion_write_aggregates',
      'identity_erasure_requests',
    ])
      if (!(await runner.hasTable(name)))
        throw new Error(`Discussion payload registry requires ${name}`);
    const history =
      runner.connection.options.migrationsTableName ?? 'migrations';
    const applied: unknown[] = (await runner.hasTable(history))
      ? await runner.query(
          `SELECT name FROM ${runner.connection.driver.escape(
            history
          )} WHERE name = ?`,
          [this.constructor.name]
        )
      : [];
    if (!(await runner.hasTable(tableName))) {
      if (applied.length)
        throw new Error('Applied discussion payload registry is missing');
      await runner.query(`CREATE TABLE discussion_payload_objects (
        objectKey varchar(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
        nodeId char(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        ownerIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
        tenantId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
        sha256 char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        bytes int UNSIGNED NOT NULL, state varchar(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        registeredAt bigint UNSIGNED NOT NULL, retiredAt bigint UNSIGNED NULL,
        INDEX idx_payload_owner (ownerIdentityId, state, objectKey),
        INDEX idx_payload_actor (actorIdentityId, objectKey),
        INDEX idx_payload_node (nodeId, objectKey)
      ) ENGINE=InnoDB`);
    }
    const table = await runner.getTable(tableName);
    const anonymousOwners: unknown[] =
      table?.findColumnByName('ownerIdentityId')?.isNullable &&
      (await runner.hasTable(history))
        ? await runner.query(
            `SELECT name FROM ${runner.connection.driver.escape(
              history
            )} WHERE name=?`,
            ['DiscussionAuthorErasure1791840006000']
          )
        : [];
    const info: { name: string; engine: string; collation: string | null }[] =
      await runner.query(
        'SELECT c.COLUMN_NAME AS name, t.ENGINE AS engine, c.COLLATION_NAME AS collation FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=?',
        [tableName]
      );
    const triggers: unknown[] = await runner.query(
      'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE=?',
      [tableName]
    );
    if (
      !table ||
      table.columns.length !== columns.length ||
      table.foreignKeys.length ||
      triggers.length ||
      table.primaryColumns.map((column) => column.name).join(',') !==
        'objectKey' ||
      [
        ...table.uniques,
        ...table.indices.filter((index) => index.isUnique),
      ].some((index) => index.columnNames.join(',') !== 'objectKey')
    )
      throw new Error('Incompatible discussion payload registry schema');
    for (const [name, type, length, nullable, collation] of columns) {
      const column = table.columns.find((column) => column.name === name);
      const meta = info.find((column) => column.name === name);
      if (
        !column ||
        column.type !== type ||
        column.length !== length ||
        column.isNullable !==
          (name === 'ownerIdentityId' && anonymousOwners.length > 0
            ? true
            : nullable) ||
        column.isGenerated ||
        meta?.engine.toLowerCase() !== 'innodb' ||
        meta.collation !== collation ||
        (collation === null && !column.unsigned)
      )
        throw new Error(`Incompatible discussion payload registry ${name}`);
    }
    const indexes: {
      name: string;
      columns: string;
      prefix: number | null;
      nonUnique: string | number;
    }[] = await runner.query(
      'SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns, MAX(SUB_PART) AS prefix, MIN(NON_UNIQUE) AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? GROUP BY INDEX_NAME',
      [tableName]
    );
    for (const [name, names, nonUnique] of [
      ['PRIMARY', 'objectKey', 0],
      ['idx_payload_owner', 'ownerIdentityId,state,objectKey', 1],
      ['idx_payload_actor', 'actorIdentityId,objectKey', 1],
      ['idx_payload_node', 'nodeId,objectKey', 1],
    ] as const)
      if (
        !indexes.some(
          (index) =>
            index.name === name &&
            index.columns === names &&
            Number(index.nonUnique) === nonUnique &&
            index.prefix === null
        )
      )
        throw new Error(
          `Incompatible discussion payload registry index ${name}`
        );

    const nodesTable = await runner.getTable('discussion_write_nodes');
    if (
      !nodesTable?.indices.some(
        (index) => index.name === 'idx_discussion_payload_key'
      )
    ) {
      if (applied.length)
        throw new Error(
          'Applied discussion payload reference index is missing'
        );
      await runner.createIndex(
        'discussion_write_nodes',
        new TableIndex({
          name: 'idx_discussion_payload_key',
          columnNames: ['payloadKey'],
        })
      );
    }
    const referenceIndex: {
      name: string;
      prefix: number | null;
      nonUnique: string | number;
    }[] = await runner.query(
      "SELECT COLUMN_NAME AS name, SUB_PART AS prefix, NON_UNIQUE AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='discussion_write_nodes' AND INDEX_NAME='idx_discussion_payload_key' ORDER BY SEQ_IN_INDEX"
    );
    if (
      referenceIndex.length !== 1 ||
      referenceIndex[0].name !== 'payloadKey' ||
      referenceIndex[0].prefix !== null ||
      Number(referenceIndex[0].nonUnique) !== 1
    )
      throw new Error('Incompatible discussion payload reference index');

    // Only canonical current references have provable owners. Unknown historical/orphan keys require separate inventory.
    let after: string | null = null;
    for (;;) {
      const nodes: Record<string, unknown>[] = await runner.query(
        `SELECT n.nodeId, n.ownerIdentityId, n.payloadKey, n.payloadHash, n.payloadBytes, a.tenantId
        FROM discussion_write_nodes n LEFT JOIN discussion_write_aggregates a ON a.id=n.discussionId
        WHERE (? IS NULL OR n.nodeId > ?) ORDER BY n.nodeId LIMIT 256`,
        [after, after]
      );
      for (const node of nodes) {
        if (typeof node.nodeId !== 'string')
          throw new Error('Invalid current discussion node');
        after = node.nodeId;
        if (node.payloadKey === null) {
          if (node.payloadHash !== null || node.payloadBytes !== null)
            throw new Error('Incomplete discussion payload reference');
          continue;
        }
        const canonical = registeredDiscussionPayload({
          objectKey: node.payloadKey,
          nodeId: node.nodeId,
          ownerIdentityId: node.ownerIdentityId,
          actorIdentityId: null,
          tenantId: node.tenantId,
          sha256: node.payloadHash,
          bytes: node.payloadBytes,
          state: 'committed',
          registeredAt: Date.now(),
          retiredAt: null,
        });
        const [stored]: Record<string, unknown>[] = await runner.query(
          'SELECT * FROM discussion_payload_objects WHERE objectKey = ?',
          [canonical.reference.key]
        );
        if (!stored) {
          if (applied.length)
            throw new Error(
              'Committed discussion payload registration is missing'
            );
          await runner.query(
            `INSERT INTO discussion_payload_objects
            (objectKey, nodeId, ownerIdentityId, actorIdentityId, tenantId, sha256, bytes, state, registeredAt, retiredAt)
            VALUES (?, ?, ?, NULL, ?, ?, ?, 'committed', ?, NULL)`,
            [
              canonical.reference.key,
              canonical.nodeId,
              canonical.ownerIdentityId,
              canonical.tenantId,
              canonical.reference.sha256,
              canonical.reference.bytes,
              canonical.registeredAt,
            ]
          );
        } else {
          const existing = registeredDiscussionPayload(stored);
          if (
            existing.state !== 'committed' ||
            existing.nodeId !== canonical.nodeId ||
            existing.ownerIdentityId !== canonical.ownerIdentityId ||
            existing.tenantId !== canonical.tenantId ||
            existing.reference.sha256 !== canonical.reference.sha256 ||
            existing.reference.bytes !== canonical.reference.bytes
          )
            throw new Error(
              'Committed discussion payload registration disagrees with authority'
            );
        }
      }
      if (nodes.length < 256) break;
    }
    after = null;
    for (;;) {
      const rows: Record<string, unknown>[] = await runner.query(
        'SELECT * FROM discussion_payload_objects WHERE (? IS NULL OR objectKey > ?) ORDER BY objectKey LIMIT 256',
        [after, after]
      );
      for (const row of rows)
        after = registeredDiscussionPayload(row).reference.key;
      if (rows.length < 256) break;
    }
  }

  async down(): Promise<void> {
    throw new Error(
      'Discussion payload ownership and retirement require a reviewed data-preserving rollback'
    );
  }
}
