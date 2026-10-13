import type { DataSource, EntityManager } from 'typeorm';
import {
  defaultAccountPreferences,
  parseAccountPreferences,
} from '@domains/customer/preferences';
import {
  publicCommentId,
  notificationRecipient,
  replyNotificationEvent,
  notificationTimestamp,
  type ReplyNotificationEvent,
  type replyInboxCursor,
} from '@sdk/features/discussion/core';
import {
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  type CanonicalIdentityState,
} from '@sdk/features/identity/core';
import type {
  ReplyInboxStore,
  ReplyInboxSnapshot,
} from '@sdk/features/identity/libs/management';
import {
  readCanonicalIdentity,
  assertActiveIdentity,
  canonicalSqlInteger as integer,
} from './canonical-account-sql';

type Row = Record<string, unknown>;
export function replyInboxRecord(row: Row) {
  const event = replyNotificationEvent({
    id: row.id,
    recipientId: row.identityId,
    discussionId: row.discussionId,
    parentId: row.parentId,
    revision: integer(row.revision, 2),
    at: integer(row.createdAt),
  });
  const receivedAt = notificationTimestamp(integer(row.receivedAt, 1), 1),
    readAt =
      row.readAt === null
        ? null
        : notificationTimestamp(integer(row.readAt, 1), 1);
  if (
    receivedAt < event.at ||
    (row.delivered !== 0 && row.delivered !== 1) ||
    (readAt !== null && (row.delivered === 0 || readAt < receivedAt))
  )
    throw new Error('Invalid inbox authority');
  return { event, readAt, receivedAt, delivered: row.delivered === 1 };
}

export class MysqlReplyInbox implements ReplyInboxStore {
  constructor(
    private readonly source: DataSource,
    private readonly now = Date.now
  ) {}

  receive(
    input: ReplyNotificationEvent,
    visible: boolean
  ): Promise<'delivered' | 'suppressed'> {
    const event = replyNotificationEvent(input);
    if (typeof visible !== 'boolean')
      throw new Error('Notification visibility is required');
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const identity = await readCanonicalIdentity(tx, event.recipientId, true);
      if (!identity || identity.isDeleted) return 'suppressed';
      const [existing]: Row[] = await tx.query(
        'SELECT * FROM identity_reply_notifications WHERE identityId=? AND id=?',
        [event.recipientId, event.id]
      );
      if (existing) {
        if (
          JSON.stringify(replyInboxRecord(existing).event) !==
          JSON.stringify(event)
        )
          throw new CanonicalIdentityConflict(
            'Notification ID already refers to a different event'
          );
        return existing.delivered === 1 ? 'delivered' : 'suppressed';
      }
      const enabled =
        identity.isActive &&
        !identity.isSuspended &&
        (await this.enabled(tx, identity));
      const delivered = enabled && visible;
      await tx.query(
        'INSERT INTO identity_reply_notifications (identityId,id,discussionId,parentId,revision,createdAt,receivedAt,delivered,readAt) VALUES (?,?,?,?,?,?,?,?,NULL)',
        [
          event.recipientId,
          event.id,
          event.discussionId,
          event.parentId,
          event.revision,
          event.at,
          Math.max(event.at, identity.updatedAt, integer(this.now(), 1)),
          delivered ? 1 : 0,
        ]
      );
      return delivered ? 'delivered' : 'suppressed';
    });
  }

  list(
    uid: string,
    cursor: ReturnType<typeof replyInboxCursor>
  ): Promise<ReplyInboxSnapshot> {
    return this.snapshot(
      uid,
      cursor ? 'AND (createdAt<? OR (createdAt=? AND id<?))' : '',
      cursor ? [cursor.at, cursor.at, cursor.id] : []
    );
  }
  current(uid: string, ids: string[]): Promise<ReplyInboxSnapshot> {
    if (ids.length > 10) throw new Error('Inbox selection exceeds bounds');
    return this.snapshot(
      uid,
      ids.length ? `AND id IN (${ids.map(() => '?').join(',')})` : 'AND 1=0',
      ids.map(publicCommentId)
    );
  }
  private snapshot(
    uid: string,
    filter: string,
    values: (string | number)[]
  ): Promise<ReplyInboxSnapshot> {
    notificationRecipient(uid);
    return this.source.transaction('REPEATABLE READ', async (tx) => {
      const identity = await readCanonicalIdentity(tx, uid);
      assertActiveIdentity(identity);
      const enabled = await this.enabled(tx, identity);
      if (!enabled)
        return { revision: identity.revision, enabled, entries: [] };
      const rows: Row[] = await tx.query(
        `SELECT * FROM identity_reply_notifications WHERE identityId=? AND delivered=1 ${filter} ORDER BY createdAt DESC,id DESC LIMIT 11`,
        [uid, ...values]
      );
      return {
        revision: identity.revision,
        enabled,
        entries: rows.map(replyInboxRecord),
      };
    });
  }

  markRead(uid: string, id: string): Promise<{ id: string; readAt: number }> {
    notificationRecipient(uid);
    publicCommentId(id);
    return this.source.transaction('READ COMMITTED', async (tx) => {
      const identity = await readCanonicalIdentity(tx, uid, true);
      assertActiveIdentity(identity);
      if (!(await this.enabled(tx, identity)))
        throw new CanonicalIdentityInputError(
          'Reply notifications are disabled'
        );
      const [row]: Row[] = await tx.query(
        'SELECT * FROM identity_reply_notifications WHERE identityId=? AND id=? AND delivered=1',
        [uid, id]
      );
      if (!row)
        throw new CanonicalIdentityInputError('Notification is unavailable');
      const value = replyInboxRecord(row);
      const readAt =
        value.readAt ??
        Math.max(integer(row.receivedAt, 1), integer(this.now(), 1));
      if (value.readAt === null)
        await tx.query(
          'UPDATE identity_reply_notifications SET readAt=? WHERE identityId=? AND id=? AND readAt IS NULL',
          [readAt, uid, id]
        );
      return { id, readAt };
    });
  }

  private async enabled(
    tx: EntityManager,
    identity: CanonicalIdentityState
  ): Promise<boolean> {
    const [row]: Row[] = await tx.query(
      'SELECT preferences,updatedAt FROM identity_preferences WHERE identityId=?',
      [identity.identityId]
    );
    const updatedAt = row ? integer(row.updatedAt, 1) : null;
    if (updatedAt !== null && updatedAt > identity.updatedAt)
      throw new Error('Invalid preference authority');
    const saved = parseAccountPreferences({
      identityId: identity.identityId,
      revision: identity.revision,
      updatedAt,
      preferences: row
        ? typeof row.preferences === 'string'
          ? JSON.parse(row.preferences)
          : row.preferences
        : defaultAccountPreferences(),
    });
    return (
      saved.preferences.notifications.inApp.enabled &&
      saved.preferences.notifications.inApp.discussionReplies
    );
  }
}
