import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Local credential authority only; canonical identities remain in their owning store. */
export class LocalCredentials1792281600000 implements MigrationInterface {
  name = 'LocalCredentials1792281600000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS local_credential_users (
      uid varchar(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
      email varchar(254) COLLATE utf8mb4_bin NULL UNIQUE,
      password_salt varchar(64) NULL,
      password_hash varchar(128) NULL,
      disabled boolean NOT NULL DEFAULT false,
      deleted boolean NOT NULL DEFAULT false,
      claims_json json NOT NULL,
      created_at bigint NOT NULL,
      last_sign_in_at bigint NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
    await runner.query(`CREATE TABLE IF NOT EXISTS local_credential_sessions (
      access_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      refresh_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
      uid varchar(128) COLLATE utf8mb4_bin NOT NULL,
      auth_time bigint NOT NULL,
      access_expires_at bigint NOT NULL,
      refresh_expires_at bigint NOT NULL,
      INDEX local_sessions_user (uid),
      CONSTRAINT local_sessions_user_fk FOREIGN KEY (uid) REFERENCES local_credential_users(uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Local credentials contain authoritative state; restore a backup to roll back'
    );
  }
}
