import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing unowned content remains untouched and requires an explicit backfill. */
export class DiscussionWriteModel1791676800000 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS content_nodes (
      id varchar(36) NOT NULL PRIMARY KEY, referenceKey varchar(36) NOT NULL,
      kind varchar(128) NOT NULL, state varchar(32) NOT NULL, visibility varchar(32) NOT NULL,
      createdAt bigint NOT NULL, updatedAt bigint NULL, deletedAt bigint NULL,
      INDEX idx_content_kind (kind), INDEX idx_content_reference (referenceKey)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS content_node_relations (
      id varchar(36) NOT NULL PRIMARY KEY, fromContentId varchar(36) NOT NULL,
      toContentId varchar(36) NOT NULL, relationType varchar(128) NOT NULL, createdAt bigint NOT NULL,
      INDEX idx_relation_from (fromContentId), INDEX idx_relation_to (toContentId)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS comment_likes (
      id varchar(36) NOT NULL PRIMARY KEY, commentId varchar(36) NOT NULL,
      actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL, createdAt bigint NOT NULL,
      UNIQUE KEY uq_comment_actor (commentId, actorIdentityId)
    ) ENGINE=InnoDB`);
    await queryRunner.query(
      `ALTER TABLE comment_likes MODIFY actorIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL`
    );
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS discussion_write_aggregates (
      id varchar(36) NOT NULL PRIMARY KEY, tenantId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      revision bigint unsigned NOT NULL, subjectId varchar(36) NULL,
      createdAt bigint NOT NULL, INDEX idx_discussion_tenant (tenantId, id)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS discussion_write_nodes (
      nodeId varchar(36) NOT NULL PRIMARY KEY, discussionId varchar(36) NOT NULL,
      ownerIdentityId varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
      payloadKey varchar(512) NULL, payloadHash char(64) NULL, payloadBytes int unsigned NULL,
      INDEX idx_discussion_nodes (discussionId, nodeId)
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS discussion_commands (
      tenantId varchar(128) COLLATE utf8mb4_bin NOT NULL,
      actorIdentityId varchar(128) COLLATE utf8mb4_bin NOT NULL,
      commandKey varchar(128) COLLATE utf8mb4_bin NOT NULL,
      fingerprint char(64) NOT NULL, nodeId varchar(36) NOT NULL,
      discussionId varchar(36) NOT NULL, revision bigint unsigned NOT NULL,
      createdAt bigint NOT NULL,
      PRIMARY KEY (tenantId, actorIdentityId, commandKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS discussion_outbox (
      id varchar(36) NOT NULL PRIMARY KEY, discussionId varchar(36) NOT NULL,
      revision bigint unsigned NOT NULL, createdAt bigint NOT NULL,
      availableAt bigint NOT NULL, attempts int unsigned NOT NULL DEFAULT 0,
      leaseToken varchar(36) NULL, leasedUntil bigint NULL, deliveredAt bigint NULL,
      lastError varchar(512) NULL,
      UNIQUE KEY uq_discussion_outbox_revision (discussionId, revision),
      INDEX idx_discussion_outbox_pending (deliveredAt, availableAt, leasedUntil)
    ) ENGINE=InnoDB`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Discussion write records and outbox are authoritative. Use a reviewed forward migration to roll back.'
    );
  }
}
