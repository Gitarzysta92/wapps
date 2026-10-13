import type { DataSource } from 'typeorm';
import {
  accountErasureRequest,
  CanonicalIdentityAccessDenied,
  type AccountErasureParticipantName,
  type AccountErasureRequest,
  type AccountErasureReceipt,
} from '@sdk/features/identity/core';
import type { AccountErasureParticipant } from '@sdk/features/identity/libs/management';
import { beginIdentityErasure } from './mysql-identity-write-barrier';
import { canonicalSqlInteger } from './canonical-account-sql';

/** A durable participant request is pending until its owning cleanup transaction records completion. */
export class MysqlAccountErasureParticipant
  implements AccountErasureParticipant
{
  constructor(
    readonly name: AccountErasureParticipantName,
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}
  request(input: AccountErasureRequest): Promise<AccountErasureReceipt> {
    const request = accountErasureRequest(input);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      if (this.name === 'account') {
        const [identity]: {
          revision: unknown;
          is_deleted: number;
          is_active: number;
        }[] = await manager.query(
          'SELECT revision, is_deleted, is_active FROM identities WHERE identity_id = ? FOR UPDATE',
          [request.identityId]
        );
        if (
          !identity ||
          identity.is_deleted !== 1 ||
          identity.is_active !== 0 ||
          canonicalSqlInteger(identity.revision, 1) !== request.revision
        )
          throw new CanonicalIdentityAccessDenied(
            'A canonical account tombstone is required'
          );
      }
      const barrier = await beginIdentityErasure(
        manager,
        request.identityId,
        request.revision,
        this.now()
      );
      await manager.query(
        'INSERT INTO identity_erasure_requests (identityId, revision, requestedAt, completedAt) VALUES (?, ?, ?, NULL) ON DUPLICATE KEY UPDATE identityId = identityId',
        [request.identityId, request.revision, barrier.requestedAt]
      );
      const [row]: {
        revision: unknown;
        requestedAt: unknown;
        completedAt: unknown;
      }[] = await manager.query(
        'SELECT revision, requestedAt, completedAt FROM identity_erasure_requests WHERE identityId = ? FOR UPDATE',
        [request.identityId]
      );
      if (
        !row ||
        canonicalSqlInteger(row.revision, 1) !== request.revision ||
        canonicalSqlInteger(row.requestedAt, 1) !== barrier.requestedAt ||
        (row.completedAt !== null &&
          canonicalSqlInteger(row.completedAt, 1) <
            canonicalSqlInteger(row.requestedAt, 1))
      )
        throw new Error('Invalid durable account erasure request');
      return {
        ...request,
        participant: this.name,
        state: row.completedAt === null ? 'pending' : 'completed',
      };
    });
  }
}
