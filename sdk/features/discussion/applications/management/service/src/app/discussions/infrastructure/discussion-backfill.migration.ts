import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscussionBackfill1791676801000 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS discussion_backfills (
      discussionId varchar(36) NOT NULL PRIMARY KEY,
      manifestFingerprint char(64) NOT NULL, fingerprint char(64) NOT NULL,
      revision bigint unsigned NOT NULL, committedAt bigint NOT NULL
    ) ENGINE=InnoDB`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Backfill receipts are authoritative migration history. Use a reviewed forward migration.'
    );
  }
}
