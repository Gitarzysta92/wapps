import type { DataSource } from 'typeorm';
import type { AccountErasureRequest } from '@sdk/features/identity/core';
import type { DiscussionErasureCompletion } from '../application/clean-discussion-account';
import {
  lockDiscussionErasure,
  lockDiscussionErasureState,
} from './mysql-discussion-contribution-erasure';

const remainingAuthority = [
  ['discussion_reply_notifications', 'recipientId'],
  ['discussion_mention_notifications', 'recipientId'],
  ['discussion_write_nodes', 'ownerIdentityId'],
  ['discussion_payload_objects', 'ownerIdentityId'],
  ['discussion_payload_objects', 'actorIdentityId'],
  ['comment_likes', 'actorIdentityId'],
  ['discussion_votes', 'actorIdentityId'],
  ['discussion_commands', 'actorIdentityId'],
  ['discussion_erasure_nodes', 'identityId'],
  ['member_reviews', 'ownerId'],
  ['review_erasure_targets', 'identityId'],
  ['review_helpful', 'actorId'],
  ['review_reports', 'actorId'],
  ['review_commands', 'actorId'],
  ['review_events', 'actorId'],
] as const;

export class MysqlDiscussionErasureCompletion
  implements DiscussionErasureCompletion
{
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  state(request: AccountErasureRequest): Promise<'pending' | 'completed'> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const stored = await lockDiscussionErasureState(tx, request);
      return stored.completedAt === null ? 'pending' : 'completed';
    });
  }

  complete(request: AccountErasureRequest): Promise<'pending' | 'completed'> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const stored = await lockDiscussionErasureState(tx, request);
      if (stored.completedAt !== null) return 'completed';
      await lockDiscussionErasure(tx, request);
      // Every producer of these records takes the same permanent identity barrier first.
      for (const [table, column] of remainingAuthority) {
        const rows: unknown[] = await tx.query(
          `SELECT 1 FROM ${table} WHERE ${column}=? LIMIT 1`,
          [request.identityId]
        );
        if (rows.length) return 'pending';
      }
      const at = this.now();
      if (!Number.isSafeInteger(at) || at < 1)
        throw new Error('Invalid Discussion erasure completion time');
      await tx.query(
        'UPDATE identity_erasure_requests SET completedAt=? WHERE identityId=? AND revision=? AND completedAt IS NULL',
        [Math.max(at, stored.requestedAt), request.identityId, request.revision]
      );
      return 'completed';
    });
  }
}
