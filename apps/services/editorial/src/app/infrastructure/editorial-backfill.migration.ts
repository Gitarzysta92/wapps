import type { MigrationInterface, QueryRunner } from 'typeorm';
import { assertEditorialSchema } from './editorial-schema-compatibility';

export class EditorialBackfill1791676803000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    await assertEditorialSchema(runner);
    await runner.query(`CREATE TABLE IF NOT EXISTS editorial_backfills (
      resourceKind varchar(16) NOT NULL, resourceId varchar(36) NOT NULL,
      manifestFingerprint char(64) NOT NULL, sourceFingerprint char(64) NOT NULL, fingerprint char(64) NOT NULL,
      revision bigint unsigned NOT NULL, committedAt bigint NOT NULL,
      PRIMARY KEY (resourceKind, resourceId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Editorial backfill receipts are authoritative; use a reviewed forward migration'
    );
  }
}
