import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CredentialBindings1792281601000 implements MigrationInterface {
  name = 'CredentialBindings1792281601000';

  async up(runner: QueryRunner): Promise<void> {
    // No inferred backfill: historical UIDs require an explicitly verified mapping.
    await runner.query(`CREATE TABLE IF NOT EXISTS identity_credential_bindings (
      issuer varbinary(128) NOT NULL,
      subject varbinary(128) NOT NULL,
      identityId varchar(128) COLLATE utf8mb4_bin NOT NULL,
      createdAt bigint NOT NULL,
      PRIMARY KEY (issuer, subject),
      INDEX credential_identity (identityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Credential bindings preserve ownership; restore a verified backup to roll back'
    );
  }
}
