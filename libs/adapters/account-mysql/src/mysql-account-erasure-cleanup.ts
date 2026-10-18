import type { DataSource } from 'typeorm';
import {
  accountErasureRequest,
  CanonicalIdentityAccessDenied,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import type { AccountErasureCleanup } from '@sdk/features/identity/libs/management';
import {
  canonicalSqlInteger,
  readCanonicalIdentity,
} from './canonical-account-sql';
import { identityErasureBarrier } from './mysql-identity-write-barrier';

const batch = 128;

/** Account-owned private state only. Tombstones, barriers and lifecycle delivery remain authoritative. */
export class MysqlAccountErasureCleanup implements AccountErasureCleanup {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  advance(input: AccountErasureRequest): Promise<'pending' | 'completed'> {
    const request = accountErasureRequest(input);
    return this.source.transaction('READ COMMITTED', async (manager) => {
      // Account writers, exports, badges and follows serialize against this identity first.
      const identity = await readCanonicalIdentity(
        manager,
        request.identityId,
        true
      );
      if (
        !identity ||
        !identity.isDeleted ||
        identity.isActive ||
        identity.revision !== request.revision
      )
        throw new CanonicalIdentityAccessDenied(
          'An exact canonical account tombstone is required'
        );
      const [stored]: Record<string, unknown>[] = await manager.query(
        'SELECT identityId, erasureRevision, requestedAt FROM identity_erasure_barriers WHERE identityId = ? FOR UPDATE',
        [request.identityId]
      );
      if (!stored) throw new Error('Account erasure barrier is missing');
      const barrier = identityErasureBarrier(stored);
      const [receipt]: Record<string, unknown>[] = await manager.query(
        'SELECT revision, requestedAt, completedAt FROM identity_erasure_requests WHERE identityId = ? FOR UPDATE',
        [request.identityId]
      );
      if (
        barrier.identityId !== request.identityId ||
        barrier.erasureRevision !== request.revision ||
        !receipt ||
        canonicalSqlInteger(receipt.revision, 1) !== request.revision ||
        canonicalSqlInteger(receipt.requestedAt, 1) !== barrier.requestedAt
      )
        throw new Error('Account erasure request is missing or inconsistent');
      if (receipt.completedAt !== null) {
        if (
          canonicalSqlInteger(receipt.completedAt, 1) <
          canonicalSqlInteger(receipt.requestedAt, 1)
        )
          throw new Error('Invalid cleanup completion');
        return 'completed';
      }
      for (const table of [
        'identity_profile_avatars',
        'identity_accounts',
        'identity_preferences',
        'identity_reply_notifications',
        'identity_mention_notifications',
        'identity_favorite_watches',
        'identity_favorite_notifications',
        'identity_favorites',
        'identity_account_commands',
      ]) {
        await manager.query(
          `DELETE FROM ${table} WHERE identityId = ? LIMIT ${batch}`,
          [request.identityId]
        );
      }
      for (const table of [
        'identity_profile_follow_commands',
        'identity_profile_follows',
      ]) {
        await manager.query(
          `DELETE FROM ${table} WHERE ownerId = ? OR requesterId = ? LIMIT ${batch}`,
          [identity.subjectId, identity.subjectId]
        );
      }
      await manager.query(
        `DELETE FROM identity_profile_badges WHERE ownerId = ? LIMIT ${batch}`,
        [identity.subjectId]
      );
      await manager.query(
        `DELETE FROM identity_profile_badge_events WHERE ownerId = ? ORDER BY revision LIMIT ${batch}`,
        [identity.subjectId]
      );
      await manager.query(
        `UPDATE identity_profile_badge_events SET actorId = NULL, reason = NULL, commandKey = NULL, fingerprint = NULL WHERE actorId = ? ORDER BY ownerId, revision LIMIT ${batch}`,
        [identity.subjectId]
      );

      // Remove bounded chunks before their job, so a large archive cannot monopolize a transaction.
      const exports: { id: string }[] = await manager.query(
        'SELECT id FROM identity_account_exports WHERE identityId = ? ORDER BY id LIMIT 8 FOR UPDATE',
        [request.identityId]
      );
      for (const job of exports) {
        await manager.query(
          'DELETE FROM identity_account_export_chunks WHERE exportId = ? ORDER BY attemptId, position LIMIT 16',
          [job.id]
        );
        const remaining: unknown[] = await manager.query(
          'SELECT 1 FROM identity_account_export_chunks WHERE exportId = ? LIMIT 1',
          [job.id]
        );
        if (!remaining.length)
          await manager.query(
            'DELETE FROM identity_account_exports WHERE id = ? AND identityId = ?',
            [job.id, request.identityId]
          );
      }
      for (const table of [
        'identity_profile_avatars',
        'identity_accounts',
        'identity_preferences',
        'identity_reply_notifications',
        'identity_mention_notifications',
        'identity_favorite_watches',
        'identity_favorite_notifications',
        'identity_favorites',
        'identity_account_commands',
        'identity_account_exports',
      ]) {
        const remaining: unknown[] = await manager.query(
          `SELECT 1 FROM ${table} WHERE identityId = ? LIMIT 1`,
          [request.identityId]
        );
        if (remaining.length) return 'pending';
      }
      for (const table of [
        'identity_profile_follow_commands',
        'identity_profile_follows',
      ]) {
        const remaining: unknown[] = await manager.query(
          `SELECT 1 FROM ${table} WHERE ownerId = ? OR requesterId = ? LIMIT 1`,
          [identity.subjectId, identity.subjectId]
        );
        if (remaining.length) return 'pending';
      }
      for (const [table, condition, values] of [
        ['identity_profile_badges', 'ownerId = ?', [identity.subjectId]],
        [
          'identity_profile_badge_events',
          'ownerId = ? OR actorId = ?',
          [identity.subjectId, identity.subjectId],
        ],
      ] as const) {
        const remaining: unknown[] = await manager.query(
          `SELECT 1 FROM ${table} WHERE ${condition} LIMIT 1`,
          [...values]
        );
        if (remaining.length) return 'pending';
      }
      await manager.query(
        'UPDATE identity_erasure_requests SET completedAt = ? WHERE identityId = ? AND revision = ? AND completedAt IS NULL',
        [
          Math.max(
            canonicalSqlInteger(receipt.requestedAt, 1),
            canonicalSqlInteger(this.now(), 1)
          ),
          request.identityId,
          request.revision,
        ]
      );
      return 'completed';
    });
  }
}
