import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  publicCommentId,
  replyNotificationEvent,
  notificationInteger,
  notificationTimestamp,
  type ReplyNotificationLease,
} from '@domains/community';
import type {
  ReplyNotificationJournal,
  ReplyNotificationCandidate,
} from '../application/reply-notifications';

type Row = Record<string, unknown>;
function number(value: unknown): number {
  return notificationInteger(
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  );
}

export function replyNotificationJournalRow(row: Row) {
  const value = event(row),
    attempts = number(row.attempts);
  const timestamp = (input: unknown) =>
    input === null ? null : notificationTimestamp(number(input));
  const availableAt = notificationTimestamp(number(row.availableAt)),
    leasedUntil = timestamp(row.leasedUntil),
    deliveredAt = timestamp(row.deliveredAt),
    failedAt = timestamp(row.failedAt);
  const token =
    row.leaseToken === null ? null : publicCommentId(row.leaseToken);
  if (
    availableAt < value.at ||
    attempts > 12 ||
    (token === null) !== (leasedUntil === null) ||
    [leasedUntil, deliveredAt, failedAt].some(
      (at) => at !== null && at < value.at
    ) ||
    (deliveredAt !== null && failedAt !== null) ||
    ((deliveredAt !== null || failedAt !== null) && token !== null) ||
    ((token !== null || deliveredAt !== null || failedAt !== null) &&
      attempts === 0) ||
    (failedAt !== null && attempts !== 12)
  )
    throw new Error('Invalid reply notification delivery journal');
  return {
    event: value,
    attempts,
    availableAt,
    token,
    leasedUntil,
    deliveredAt,
    failedAt,
  };
}
function event(row: Row) {
  return replyNotificationEvent({
    id: row.id,
    recipientId: row.recipientId,
    discussionId: row.discussionId,
    parentId: row.parentId,
    revision: number(row.revision),
    at: number(row.createdAt),
  });
}

export class MysqlReplyNotifications implements ReplyNotificationJournal {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  claim(): Promise<ReplyNotificationLease | null> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const at = notificationTimestamp(this.now(), 1);
      const [row]: Row[] = await tx.query(
        'SELECT * FROM discussion_reply_notifications WHERE deliveredAt IS NULL AND failedAt IS NULL AND availableAt<=? AND (leasedUntil IS NULL OR leasedUntil<=?) ORDER BY availableAt,id LIMIT 1 FOR UPDATE SKIP LOCKED',
        [at, at]
      );
      if (!row) return null;
      const token = randomUUID(),
        until = at + 30_000;
      const { event: value, attempts } = replyNotificationJournalRow(row);
      if (attempts === 12) {
        // Expired leases consume attempts too, including crashes before a failure receipt.
        await tx.query(
          'UPDATE discussion_reply_notifications SET failedAt=?,leaseToken=NULL,leasedUntil=NULL WHERE id=?',
          [at, value.id]
        );
        return null;
      }
      await tx.query(
        'UPDATE discussion_reply_notifications SET attempts=?,leaseToken=?,leasedUntil=? WHERE id=?',
        [attempts + 1, token, until, value.id]
      );
      return { event: value, token, until };
    });
  }

  settle(
    id: string,
    token: string,
    failed: boolean
  ): Promise<'settled' | 'superseded'> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const [row]: Row[] = await tx.query(
        'SELECT * FROM discussion_reply_notifications WHERE id=? FOR UPDATE',
        [publicCommentId(id)]
      );
      const at = notificationTimestamp(this.now(), 1);
      if (
        !row ||
        row.leaseToken !== publicCommentId(token) ||
        row.leasedUntil === null ||
        number(row.leasedUntil) <= at ||
        row.deliveredAt !== null ||
        row.failedAt !== null
      )
        return 'superseded';
      replyNotificationJournalRow(row);
      const attempts = number(row.attempts);
      if (attempts < 1 || attempts > 12)
        throw new Error('Invalid notification attempts');
      await tx.query(
        'UPDATE discussion_reply_notifications SET attempts=?,availableAt=?,leaseToken=NULL,leasedUntil=NULL,deliveredAt=?,failedAt=? WHERE id=? AND leaseToken=?',
        [
          attempts,
          failed ? at + Math.min(300_000, 1000 * 2 ** attempts) : at,
          failed ? null : at,
          failed && attempts === 12 ? at : null,
          id,
          token,
        ]
      );
      return 'settled';
    });
  }

  async current(
    recipient: string,
    ids: string[],
    tenant: string
  ): Promise<ReplyNotificationCandidate[]> {
    if (ids.length > 10)
      throw new Error('Notification selection exceeds bounds');
    if (!ids.length) return [];
    const rows: Row[] = await this.source.query(
      `SELECT e.*,a.subjectId,a.subjectKind,a.revision currentRevision FROM discussion_reply_notifications e
       JOIN discussion_write_nodes reply ON reply.nodeId=e.id AND reply.discussionId=e.discussionId
       JOIN content_nodes n ON n.id=reply.nodeId AND n.kind='comment' AND n.deletedAt IS NULL AND n.state='published' AND n.visibility='public'
       JOIN discussion_write_nodes parent ON parent.nodeId=e.parentId AND parent.discussionId=e.discussionId AND parent.ownerIdentityId=e.recipientId
       JOIN content_nodes p ON p.id=parent.nodeId AND p.deletedAt IS NULL AND p.state='published' AND p.visibility='public'
       JOIN content_node_relations relation ON relation.fromContentId=e.id AND relation.toContentId=e.parentId AND relation.relationType='replies'
       JOIN discussion_write_aggregates a ON a.id=e.discussionId AND a.tenantId=? AND a.subjectKind IN ('application','article')
       JOIN content_nodes root ON root.id=a.id AND root.kind='discussion' AND root.deletedAt IS NULL AND root.state='published' AND root.visibility='public'
       JOIN identity_erasure_barriers b ON b.identityId=e.recipientId AND b.erasureRevision IS NULL
       WHERE e.recipientId=? AND e.id IN (${ids
         .map(() => '?')
         .join(',')}) ORDER BY e.id LIMIT 11`,
      [tenant, recipient, ...ids.map(publicCommentId)]
    );
    if (
      rows.length > 10 ||
      new Set(rows.map((row) => row.id)).size !== rows.length
    )
      throw new Error('Ambiguous notification graph');
    return rows.map((row) => {
      if (row.subjectKind !== 'article' && row.subjectKind !== 'application')
        throw new Error('Invalid notification target kind');
      const value = event(row),
        currentRevision = number(row.currentRevision);
      if (currentRevision < value.revision)
        throw new Error('Notification revision is ahead of authority');
      return {
        event: value,
        currentRevision,
        target: { kind: row.subjectKind, id: publicCommentId(row.subjectId) },
      };
    });
  }

  async status() {
    const counts: Row[] = await this.source.query(
      `SELECT CASE WHEN deliveredAt IS NOT NULL THEN 'delivered' WHEN failedAt IS NOT NULL THEN 'failed'
       WHEN leasedUntil>? THEN 'leased' ELSE 'pending' END state,COUNT(*) total
       FROM discussion_reply_notifications GROUP BY state`,
      [this.now()]
    );
    const failed: Row[] = await this.source.query(
      'SELECT id,attempts,failedAt FROM discussion_reply_notifications WHERE deliveredAt IS NULL AND failedAt IS NOT NULL ORDER BY failedAt,id LIMIT 50'
    );
    return {
      counts: counts.map((row) => ({
        state: row.state,
        total: number(row.total),
      })),
      failed: failed.map((row) => ({
        id: publicCommentId(row.id),
        attempts: number(row.attempts),
        failedAt: number(row.failedAt),
      })),
      failurePageLimit: 50,
    };
  }

  requeue(id: string, failedAt: number): Promise<boolean> {
    publicCommentId(id);
    if (!Number.isSafeInteger(failedAt) || failedAt < 1)
      throw new Error('An exact failed notification receipt is required');
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const [row]: Row[] = await tx.query(
        'SELECT * FROM discussion_reply_notifications WHERE id=? FOR UPDATE',
        [id]
      );
      if (
        !row ||
        row.failedAt === null ||
        number(row.failedAt) !== failedAt ||
        row.deliveredAt !== null ||
        row.leaseToken !== null
      )
        return false;
      const value = replyNotificationJournalRow(row);
      await tx.query(
        'UPDATE discussion_reply_notifications SET attempts=0,failedAt=NULL,availableAt=? WHERE id=?',
        [Math.max(notificationTimestamp(this.now(), 1), value.event.at), id]
      );
      return true;
    });
  }
}
