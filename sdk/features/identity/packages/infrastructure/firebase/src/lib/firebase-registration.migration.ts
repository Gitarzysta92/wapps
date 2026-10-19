import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FirebaseRegistration1792454400000 implements MigrationInterface {
  name = 'FirebaseRegistration1792454400000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS firebase_credential_enrollments (
      issuer varbinary(128) NOT NULL,
      email_hash binary(32) NOT NULL,
      request_hash binary(32) NOT NULL,
      subject varbinary(128) NOT NULL,
      created tinyint unsigned NOT NULL DEFAULT 0,
      PRIMARY KEY (issuer, email_hash),
      UNIQUE KEY firebase_enrollment_subject (issuer, subject)
    ) ENGINE=InnoDB`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Enrollment receipts require backup restoration for rollback'
    );
  }
}
