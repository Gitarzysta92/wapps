import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  publicCommentId,
  mentionNotificationEvent,
  notificationInteger,
  notificationRecipient,
  notificationTimestamp,
  type MentionNotificationLease,
} from '@domains/community';
import type {
  MentionNotificationJournal,
  MentionNotificationCandidate,
} from '../application/mention-notifications';

type Row = Record<string, unknown>;
function number(value: unknown): number {
  return notificationInteger(
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  );
}

export function mentionNotificationJournalRow(row: Row) {
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
    (row.active !== 0 && row.active !== 1) ||
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
    throw new Error('Invalid mention notification delivery journal');
  return {
    event: value,
    profileId: publicCommentId(row.profileId),
    active: row.active === 1,
    attempts,
    availableAt,
    token,
    leasedUntil,
    deliveredAt,
    failedAt,
  };
}
function event(row: Row) {
  return mentionNotificationEvent({
    id: row.id,
    recipientId: row.recipientId,
    discussionId: row.discussionId,
    nodeId: row.nodeId,
    revision: number(row.revision),
    at: number(row.createdAt),
  });
}

export class MysqlMentionNotifications implements MentionNotificationJournal {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  claim(): Promise<MentionNotificationLease | null> {
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const at = notificationTimestamp(this.now(), 1);
      const [row]: Row[] = await tx.query(
        'SELECT * FROM discussion_mention_notifications WHERE deliveredAt IS NULL AND failedAt IS NULL AND availableAt<=? AND (leasedUntil IS NULL OR leasedUntil<=?) ORDER BY availableAt,id LIMIT 1 FOR UPDATE SKIP LOCKED',
        [at, at]
      );
      if (!row) return null;
      const token = randomUUID(),
        until = at + 30_000;
      const { event: value, attempts } = mentionNotificationJournalRow(row);
      if (attempts === 12) {
        // Expired leases consume attempts too, including crashes before a failure receipt.
        await tx.query(
          'UPDATE discussion_mention_notifications SET failedAt=?,leaseToken=NULL,leasedUntil=NULL WHERE id=?',
          [at, value.id]
        );
        return null;
      }
      await tx.query(
        'UPDATE discussion_mention_notifications SET attempts=?,leaseToken=?,leasedUntil=? WHERE id=?',
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
        'SELECT * FROM discussion_mention_notifications WHERE id=? FOR UPDATE',
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
      mentionNotificationJournalRow(row);
      const attempts = number(row.attempts);
      if (attempts < 1 || attempts > 12)
        throw new Error('Invalid notification attempts');
      await tx.query(
        'UPDATE discussion_mention_notifications SET attempts=?,availableAt=?,leaseToken=NULL,leasedUntil=NULL,deliveredAt=?,failedAt=? WHERE id=? AND leaseToken=?',
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
  ): Promise<MentionNotificationCandidate[]> {
    if (ids.length > 10)
      throw new Error('Notification selection exceeds bounds');
    if (!ids.length) return [];
    const rows: Row[] = await this.source.query(
      `SELECT e.*,a.subjectId,a.subjectKind,a.revision currentRevision,post.ownerIdentityId authorId
       FROM discussion_mention_notifications e
       JOIN discussion_write_nodes post ON post.nodeId=e.nodeId AND post.discussionId=e.discussionId AND post.ownerIdentityId IS NOT NULL
       JOIN content_nodes n ON n.id=post.nodeId AND n.deletedAt IS NULL AND n.state='published' AND n.visibility='public'
       JOIN discussion_write_aggregates a ON a.id=e.discussionId AND a.tenantId=? AND a.subjectKind IN ('application','article')
       JOIN content_nodes root ON root.id=a.id AND root.kind='discussion' AND root.deletedAt IS NULL AND root.state='published' AND root.visibility='public'
       JOIN identity_erasure_barriers b ON b.identityId=e.recipientId AND b.erasureRevision IS NULL
       JOIN identity_erasure_barriers author ON author.identityId=post.ownerIdentityId AND author.erasureRevision IS NULL
       WHERE e.active=1 AND e.recipientId=? AND e.id IN (${ids
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
      const value = mentionNotificationJournalRow(row).event,
        currentRevision = number(row.currentRevision);
      if (currentRevision < value.revision)
        throw new Error('Notification revision is ahead of authority');
      return {
        event: value,
        currentRevision,
        authorId: notificationRecipient(row.authorId),
        profileId: publicCommentId(row.profileId),
        target: { kind: row.subjectKind, id: publicCommentId(row.subjectId) },
      };
    });
  }

  async status() {
    const counts: Row[] = await this.source.query(
      `SELECT CASE WHEN deliveredAt IS NOT NULL THEN 'delivered' WHEN failedAt IS NOT NULL THEN 'failed'
       WHEN leasedUntil>? THEN 'leased' ELSE 'pending' END state,COUNT(*) total
       FROM discussion_mention_notifications GROUP BY state`,
      [this.now()]
    );
    const failed: Row[] = await this.source.query(
      'SELECT id,attempts,failedAt FROM discussion_mention_notifications WHERE deliveredAt IS NULL AND failedAt IS NOT NULL ORDER BY failedAt,id LIMIT 50'
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
        'SELECT * FROM discussion_mention_notifications WHERE id=? FOR UPDATE',
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
      const value = mentionNotificationJournalRow(row);
      await tx.query(
        'UPDATE discussion_mention_notifications SET attempts=0,failedAt=NULL,availableAt=? WHERE id=?',
        [Math.max(notificationTimestamp(this.now(), 1), value.event.at), id]
      );
      return true;
    });
  }
}
