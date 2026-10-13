import type { DataSource } from 'typeorm';
import type {
  IdentityDeletionJobs,
  IdentityDeletionWork,
} from '@sdk/features/identity/libs/management';

export class MysqlIdentityDeletions implements IdentityDeletionJobs {
  constructor(
    protected readonly source: DataSource,
    private readonly table:
      | 'identity_deletion_jobs'
      | 'identity_erasure_jobs' = 'identity_deletion_jobs'
  ) {
    if (table !== 'identity_deletion_jobs' && table !== 'identity_erasure_jobs')
      throw new Error('Invalid identity cleanup journal');
  }

  claim(at: number, token: string): Promise<IdentityDeletionWork | null> {
    return this.source.transaction('READ COMMITTED', async (manager) => {
      const [row] = await manager.query<
        { identityId: string; revision: string | number; attempts: number }[]
      >(
        `SELECT identityId, revision, attempts FROM ${this.table} WHERE completedAt IS NULL AND failedAt IS NULL AND availableAt <= ? AND (leasedUntil IS NULL OR leasedUntil < ?) ORDER BY availableAt, identityId LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [at, at]
      );
      if (!row) return null;
      const [state] = await manager.query<
        { is_deleted: number; is_active: number; revision: string | number }[]
      >(
        'SELECT is_deleted, is_active, revision FROM identities WHERE identity_id = ?',
        [row.identityId]
      );
      const revision = Number(row.revision);
      const tombstone =
        Number.isSafeInteger(revision) &&
        revision > 0 &&
        state?.is_deleted === 1 &&
        state.is_active === 0 &&
        Number.isSafeInteger(Number(state.revision)) &&
        (this.table === 'identity_erasure_jobs'
          ? Number(state.revision) === revision
          : Number(state.revision) >= revision);
      await manager.query(
        `UPDATE ${this.table} SET leaseToken = ?, leasedUntil = ? WHERE identityId = ?`,
        [token, at + 30_000, row.identityId]
      );
      return {
        identityId: row.identityId,
        revision,
        attempts: row.attempts,
        tombstone,
      };
    });
  }

  async complete(uid: string, token: string, at: number): Promise<boolean> {
    const result: { affectedRows: number } = await this.source.query(
      `UPDATE ${this.table} SET completedAt = ?, leaseToken = NULL, leasedUntil = NULL WHERE identityId = ? AND leaseToken = ? AND completedAt IS NULL AND failedAt IS NULL`,
      [at, uid, token]
    );
    return result.affectedRows === 1;
  }

  async failed(
    uid: string,
    token: string,
    attempts: number,
    availableAt: number,
    failedAt: number | null
  ): Promise<void> {
    await this.source.query(
      `UPDATE ${this.table} SET attempts = ?, availableAt = ?, failedAt = ?, leaseToken = NULL, leasedUntil = NULL WHERE identityId = ? AND leaseToken = ? AND completedAt IS NULL AND failedAt IS NULL`,
      [attempts, availableAt, failedAt, uid, token]
    );
  }
}
