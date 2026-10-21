import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LocalEnrollment1792281602000 implements MigrationInterface {
  name = 'LocalEnrollment1792281602000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS local_credential_enrollments (
      uid varchar(128) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
      request_hash char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      CONSTRAINT local_enrollment_user_fk FOREIGN KEY (uid) REFERENCES local_credential_users(uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }
  async down(): Promise<void> {
    throw new Error(
      'Enrollment receipts require backup restoration for rollback'
    );
  }
}
