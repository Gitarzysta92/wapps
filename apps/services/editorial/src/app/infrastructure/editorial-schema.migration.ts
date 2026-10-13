import type { MigrationInterface, QueryRunner } from 'typeorm';
import { assertEditorialSchema } from './editorial-schema-compatibility';

/** Existing catalog rows remain public legacy data; no ownership is inferred. */
export class EditorialOwnership1791676802000 implements MigrationInterface {
  transaction = false;

  async up(runner: QueryRunner): Promise<void> {
    await assertEditorialSchema(runner);
    await runner.query(`CREATE TABLE IF NOT EXISTS categories (
      id varchar(36) NOT NULL PRIMARY KEY, name varchar(255) NOT NULL, slug varchar(255) NOT NULL UNIQUE,
      parentId varchar(36) NULL, createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      CONSTRAINT fk_editorial_category_parent FOREIGN KEY (parentId) REFERENCES categories(id)
    ) ENGINE=InnoDB`);
    await runner.query(`CREATE TABLE IF NOT EXISTS tags (
      id varchar(36) NOT NULL PRIMARY KEY, name varchar(255) NOT NULL, slug varchar(255) NOT NULL UNIQUE,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
    ) ENGINE=InnoDB`);
    for (const table of [
      'platforms',
      'devices',
      'socials',
      'stores',
      'monetization_models',
      'user_spans',
    ]) {
      await runner.query(`CREATE TABLE IF NOT EXISTS ${table} (
        id varchar(36) NOT NULL PRIMARY KEY, name varchar(255) NOT NULL UNIQUE, slug varchar(255) NOT NULL UNIQUE
      ) ENGINE=InnoDB`);
    }
    await runner.query(`CREATE TABLE IF NOT EXISTS app_records (
      id varchar(36) NOT NULL PRIMARY KEY, name varchar(255) NOT NULL, slug varchar(255) NOT NULL UNIQUE,
      description text NULL, website varchar(500) NULL, isPwa tinyint NOT NULL DEFAULT 0,
      rating decimal(2,1) NULL, estimatedNumberOfUsers int NULL, isSuspended tinyint NOT NULL DEFAULT 0,
      logoUrl varchar(255) NULL, bannerUrl varchar(255) NULL, categoryId varchar(36) NULL,
      createdAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updatedAt datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      CONSTRAINT fk_editorial_app_category FOREIGN KEY (categoryId) REFERENCES categories(id)
    ) ENGINE=InnoDB`);
    for (const [table, column, target] of [
      ['app_record_tags', 'tagsId', 'tags'],
      ['app_record_platforms', 'platformsId', 'platforms'],
      ['app_record_devices', 'devicesId', 'devices'],
      [
        'app_record_monetization',
        'monetizationModelsId',
        'monetization_models',
      ],
    ]) {
      await runner.query(`CREATE TABLE IF NOT EXISTS ${table} (
        appRecordsId varchar(36) NOT NULL, ${column} varchar(36) NOT NULL,
        PRIMARY KEY (appRecordsId, ${column}), INDEX idx_${table}_reference (${column}),
        CONSTRAINT fk_${table}_app FOREIGN KEY (appRecordsId) REFERENCES app_records(id) ON DELETE CASCADE,
        CONSTRAINT fk_${table}_reference FOREIGN KEY (${column}) REFERENCES ${target}(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`);
    }
    await runner.query(`CREATE TABLE IF NOT EXISTS editorial_resource_states (
      resourceKind varchar(16) NOT NULL, resourceId varchar(36) NOT NULL,
      tenantId varchar(128) NOT NULL, ownerIdentityId varchar(128) NOT NULL,
      revision bigint unsigned NOT NULL, deletedAt bigint NULL,
      PRIMARY KEY (resourceKind, resourceId), INDEX idx_editorial_tenant (tenantId, resourceKind, resourceId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    await runner.query(`CREATE TABLE IF NOT EXISTS editorial_commands (
      tenantId varchar(128) NOT NULL, actorIdentityId varchar(128) NOT NULL, commandKey varchar(128) NOT NULL,
      fingerprint char(64) NOT NULL, resourceKind varchar(16) NOT NULL, resourceId varchar(36) NOT NULL,
      revision bigint unsigned NOT NULL, deleted tinyint NOT NULL, createdAt bigint NOT NULL,
      PRIMARY KEY (tenantId, actorIdentityId, commandKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    await runner.query(`CREATE TABLE IF NOT EXISTS editorial_outbox (
      id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY, resourceKind varchar(16) NOT NULL,
      resourceId varchar(36) NOT NULL, tenantId varchar(128) NOT NULL, revision bigint unsigned NOT NULL,
      operation varchar(16) NOT NULL, actorIdentityId varchar(128) NOT NULL,
      createdAt bigint NOT NULL, availableAt bigint NOT NULL, attempts int unsigned NOT NULL DEFAULT 0,
      leaseToken varchar(36) NULL, leasedUntil bigint NULL, deliveredAt bigint NULL, failedAt bigint NULL, lastError varchar(512) NULL,
      UNIQUE KEY uq_editorial_outbox_revision (resourceKind, resourceId, revision),
      INDEX idx_editorial_outbox_pending (deliveredAt, failedAt, availableAt, leasedUntil)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Editorial ownership, command receipts and outbox are authoritative; use a reviewed forward migration'
    );
  }
}
