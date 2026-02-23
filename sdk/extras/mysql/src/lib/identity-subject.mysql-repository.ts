import type { Pool } from 'mysql2/promise';
import { err, ok, Result } from '@foundation/standard';
import { IIdentitySubjectRepository, IIdentitySubject } from '@foundation/identity-system';

export class MysqlIdentitySubjectRepository implements IIdentitySubjectRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Idempotent schema init helper.
   * Call from app bootstrap (not on hot path).
   */
  async ensureSchema(): Promise<Result<boolean, Error>> {
    try {
      // NOTE: `externalId` is camelCase to match existing conventions in this repo's MySQL tables.
      await this.pool.query(
        `CREATE TABLE IF NOT EXISTS identity_subjects (
           id VARCHAR(255) NOT NULL,
           provider VARCHAR(64) NOT NULL,
           externalId VARCHAR(255) NOT NULL,
           identityId VARCHAR(36) NOT NULL,
           createdAt BIGINT NOT NULL,
           updatedAt BIGINT NOT NULL,
           deletedAt BIGINT NOT NULL DEFAULT 0,
           PRIMARY KEY (id),
           UNIQUE KEY uq_identity_subject_provider_external (provider, externalId),
           KEY idx_identity_subject_identity (identityId)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async getByProviderClaim(
    provider: string,
    claim: string
  ): Promise<Result<IIdentitySubject | null, Error>> {
    try {
      const [rows] = await this.pool.query(
        `SELECT id, provider, externalId, identityId, createdAt, updatedAt, deletedAt
         FROM identity_subjects
         WHERE provider = ? AND externalId = ? AND deletedAt = 0
         LIMIT 1`,
        [provider, claim]
      );
      const row = (rows as any[])[0];
      const subject = row ? { ...row, claim: row.externalId } : null;
      return ok(subject as IIdentitySubject | null);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async upsert(subject: IIdentitySubject): Promise<Result<boolean, Error>> {
    try {
      await this.pool.query(
        `INSERT INTO identity_subjects
           (id, provider, externalId, identityId, createdAt, updatedAt, deletedAt)
         VALUES
           (?,  ?,        ?,         ?,          ?,        ?,        ?)
         ON DUPLICATE KEY UPDATE
           provider = VALUES(provider),
           externalId = VALUES(externalId),
           identityId = VALUES(identityId),
           updatedAt = VALUES(updatedAt),
           deletedAt = VALUES(deletedAt)`,
        [
          subject.id,
          subject.providerType,
          subject.claim,
          subject.identityId,
          subject.createdAt,
          subject.updatedAt,
          subject.deletedAt,
        ]
      );
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async deleteById(id: string): Promise<Result<boolean, Error>> {
    try {
      await this.pool.query(`DELETE FROM identity_subjects WHERE id = ?`, [id]);
      return ok(true);
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }
}

