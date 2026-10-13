import { randomUUID } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import { publicCommentId } from '@sdk/features/discussion/core';
import type { AccountErasureRequest } from '@sdk/features/identity/core';
import type { DiscussionPrivateErasure } from '../application/discussion-private-erasure.port';
import { lockDiscussionErasure } from './mysql-discussion-contribution-erasure';
import { registeredDiscussionPayload } from './mysql-discussion-payloads';
import { safeSqlInteger } from './mysql-discussion-writes';

type Row = Record<string, unknown>;
const batch = 128;

export class MysqlDiscussionPrivateErasure implements DiscussionPrivateErasure {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  advance(input: AccountErasureRequest): Promise<'pending' | 'drained'> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const request = await lockDiscussionErasure(tx, input);
      const owned: Row[] = await tx.query(
        'SELECT nodeId FROM discussion_write_nodes WHERE ownerIdentityId=? LIMIT 1',
        [request.identityId]
      );
      if (owned.length) return 'pending';

      for (const table of [
        'discussion_reply_notifications',
        'discussion_mention_notifications',
      ]) {
        const deliveries: Row[] = await tx.query(
          `SELECT id FROM ${table} WHERE recipientId=? ORDER BY id LIMIT 1`,
          [request.identityId]
        );
        if (deliveries.length) {
          await tx.query(
            `DELETE FROM ${table} WHERE recipientId=? ORDER BY id LIMIT ${batch}`,
            [request.identityId]
          );
          return 'pending';
        }
      }

      // The permanent actor barrier excludes new interactions, including queued replays.
      for (const [table, column] of [
        ['comment_likes', 'commentId'],
        ['discussion_votes', 'nodeId'],
      ] as const) {
        const [row]: Row[] = await tx.query(
          `SELECT ${column} AS nodeId FROM ${table} WHERE actorIdentityId=? ORDER BY ${column} LIMIT 1`,
          [request.identityId]
        );
        if (row) {
          await this.eraseInteractions(
            tx,
            request,
            publicCommentId(row.nodeId)
          );
          return 'pending';
        }
      }

      const receipts: Row[] = await tx.query(
        'SELECT tenantId,commandKey FROM discussion_commands WHERE actorIdentityId=? ORDER BY tenantId,commandKey LIMIT 1',
        [request.identityId]
      );
      if (receipts.length) {
        await tx.query(
          `DELETE FROM discussion_commands WHERE actorIdentityId=? ORDER BY tenantId,commandKey LIMIT ${batch}`,
          [request.identityId]
        );
        return 'pending';
      }

      const unretired: Row[] = await tx.query(
        "SELECT objectKey FROM discussion_payload_objects WHERE ownerIdentityId=? AND state<>'retired' LIMIT 1",
        [request.identityId]
      );
      if (unretired.length) return 'pending';
      const retired: Row[] = await tx.query(
        `SELECT * FROM discussion_payload_objects WHERE ownerIdentityId=? ORDER BY state,objectKey LIMIT ${batch} FOR UPDATE`,
        [request.identityId]
      );
      for (const row of retired) {
        const payload = registeredDiscussionPayload(row);
        const referenced: Row[] = await tx.query(
          'SELECT nodeId FROM discussion_write_nodes WHERE payloadKey=? LIMIT 1',
          [payload.reference.key]
        );
        if (payload.state !== 'retired' || referenced.length)
          throw new Error(
            'Discussion attribution requires retired, unreferenced bytes'
          );
        await tx.query(
          'UPDATE discussion_payload_objects SET ownerIdentityId=NULL,actorIdentityId=NULL WHERE objectKey=?',
          [payload.reference.key]
        );
      }
      if (retired.length) return 'pending';

      const acted: Row[] = await tx.query(
        `SELECT * FROM discussion_payload_objects WHERE actorIdentityId=? ORDER BY objectKey LIMIT ${batch} FOR UPDATE`,
        [request.identityId]
      );
      for (const row of acted) {
        const payload = registeredDiscussionPayload(row);
        // Staff attribution is private bookkeeping; the other author's content remains owned.
        await tx.query(
          'UPDATE discussion_payload_objects SET actorIdentityId=NULL WHERE objectKey=?',
          [payload.reference.key]
        );
      }
      return acted.length ? 'pending' : 'drained';
    });
  }

  private async eraseInteractions(
    tx: EntityManager,
    request: AccountErasureRequest,
    nodeId: string
  ): Promise<void> {
    const [mapping]: Row[] = await tx.query(
      'SELECT discussionId FROM discussion_write_nodes WHERE nodeId=?',
      [nodeId]
    );
    if (!mapping)
      throw new Error('Unmapped Discussion interaction requires repair');
    const discussionId = publicCommentId(mapping.discussionId);
    const [aggregate]: { revision: string | number }[] = await tx.query(
      'SELECT revision FROM discussion_write_aggregates WHERE id=? FOR UPDATE',
      [discussionId]
    );
    const [current]: Row[] = await tx.query(
      'SELECT m.discussionId FROM discussion_write_nodes m JOIN content_nodes n ON n.id=m.nodeId JOIN discussion_write_nodes root ON root.nodeId=m.discussionId AND root.discussionId=m.discussionId JOIN content_nodes rootNode ON rootNode.id=root.nodeId WHERE m.nodeId=? FOR UPDATE',
      [nodeId]
    );
    if (!aggregate || current?.discussionId !== discussionId)
      throw new Error('Incomplete canonical Discussion interaction graph');
    const revision = safeSqlInteger(aggregate.revision);
    const at = safeSqlInteger(this.now());
    if (revision < 1 || revision >= Number.MAX_SAFE_INTEGER || at < 1)
      throw new Error(
        'Invalid Discussion interaction erasure revision or time'
      );
    await tx.query(
      'DELETE FROM comment_likes WHERE commentId=? AND actorIdentityId=?',
      [nodeId, request.identityId]
    );
    await tx.query(
      'DELETE FROM discussion_votes WHERE nodeId=? AND actorIdentityId=?',
      [nodeId, request.identityId]
    );
    await tx.query(
      'UPDATE discussion_write_aggregates SET revision=? WHERE id=?',
      [revision + 1, discussionId]
    );
    await tx.query(
      'INSERT INTO discussion_outbox (id,discussionId,revision,createdAt,availableAt) VALUES (?,?,?,?,?)',
      [randomUUID(), discussionId, revision + 1, at, at]
    );
  }
}
