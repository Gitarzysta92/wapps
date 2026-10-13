import type { DataSource } from 'typeorm';
import type { AccountErasureJobs } from '@sdk/features/identity/libs/management';
import { MysqlIdentityDeletions } from './mysql-identity-deletions';

export class MysqlAccountErasureJobs
  extends MysqlIdentityDeletions
  implements AccountErasureJobs
{
  constructor(source: DataSource) {
    super(source, 'identity_erasure_jobs');
  }
  async defer(
    uid: string,
    token: string,
    availableAt: number
  ): Promise<boolean> {
    const result: { affectedRows: number } = await this.source.query(
      'UPDATE identity_erasure_jobs SET availableAt = ?, attempts = 0, leaseToken = NULL, leasedUntil = NULL WHERE identityId = ? AND leaseToken = ? AND completedAt IS NULL AND failedAt IS NULL',
      [availableAt, uid, token]
    );
    return result.affectedRows === 1;
  }
}
