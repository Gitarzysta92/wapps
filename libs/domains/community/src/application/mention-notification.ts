import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';
import {
  commentObject,
  discussionTarget,
  publicCommentId,
  PublicCommentInputError,
  type DiscussionTarget,
} from './public-comment';
import {
  notificationInteger,
  notificationTimestamp,
  notificationRecipient,
} from './reply-notification';

export const MENTION_NOTIFICATION_PAGE_SIZE = 10;

/** One durable intent per post and recipient, independent of post and projection IDs. */
export interface MentionNotificationEvent {
  id: string;
  recipientId: string;
  discussionId: string;
  nodeId: string;
  revision: number;
  at: number;
}

export interface MentionNotificationLease {
  event: MentionNotificationEvent;
  token: string;
  until: number;
}

export interface MentionNotificationTarget extends ClassifiedContent {
  id: string;
  nodeId: string;
  discussionId: string;
  target: DiscussionTarget;
  title: string;
  slug: string;
}

export interface MentionInboxItem extends MentionNotificationTarget {
  at: number;
  readAt: number | null;
}

export interface MentionInboxPage {
  enabled: boolean;
  items: MentionInboxItem[];
  next: string | null;
}

export function mentionNotificationEvent(
  value: unknown
): MentionNotificationEvent {
  const row = commentObject(value, [
    'id',
    'recipientId',
    'discussionId',
    'nodeId',
    'revision',
    'at',
  ]);
  const result = {
    id: publicCommentId(row['id']),
    recipientId: notificationRecipient(row['recipientId']),
    discussionId: publicCommentId(row['discussionId']),
    nodeId: publicCommentId(row['nodeId']),
    revision: notificationInteger(row['revision'], 1),
    at: notificationTimestamp(row['at']),
  };
  if (result.id === result.nodeId || result.id === result.discussionId)
    throw new PublicCommentInputError('Invalid mention notification graph');
  return result;
}

export function mentionNotificationLease(
  value: unknown
): MentionNotificationLease {
  const row = commentObject(value, ['event', 'token', 'until']);
  return {
    event: mentionNotificationEvent(row['event']),
    token: publicCommentId(row['token']),
    until: notificationTimestamp(row['until'], 1),
  };
}

export function mentionNotificationTarget(
  value: unknown
): MentionNotificationTarget {
  const row = commentObject(value, [
    'id',
    'discussionId',
    'nodeId',
    'target',
    'title',
    'slug',
    'classification',
  ]);
  if (
    typeof row['title'] !== 'string' ||
    !row['title'].trim() ||
    row['title'].length > 300 ||
    typeof row['slug'] !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row['slug']) ||
    row['slug'].length > 200
  )
    throw new PublicCommentInputError('Invalid notification target');
  return {
    id: publicCommentId(row['id']),
    discussionId: publicCommentId(row['discussionId']),
    nodeId: publicCommentId(row['nodeId']),
    target: discussionTarget(row['target']),
    ...classificationFields(row['classification']),
    title: row['title'],
    slug: row['slug'],
  };
}

export function mentionInboxCursor(
  value: unknown
): { at: number; id: string } | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !/^\d{1,16}\.[0-9a-f-]{36}$/.test(value))
    throw new PublicCommentInputError('Invalid notification cursor');
  const [at, id] = value.split('.');
  const parsed = {
    at: notificationTimestamp(Number(at)),
    id: publicCommentId(id),
  };
  if (`${parsed.at}.${parsed.id}` !== value)
    throw new PublicCommentInputError('Invalid notification cursor');
  return parsed;
}

export function mentionInboxPage(value: unknown): MentionInboxPage {
  const row = commentObject(value, ['enabled', 'items', 'next']);
  if (
    typeof row['enabled'] !== 'boolean' ||
    !Array.isArray(row['items']) ||
    row['items'].length > MENTION_NOTIFICATION_PAGE_SIZE
  )
    throw new PublicCommentInputError('Invalid notification page');
  if (row['next'] === undefined)
    throw new PublicCommentInputError('Missing notification cursor');
  const next = mentionInboxCursor(row['next']);
  const items = row['items'].map((value) => {
    const item = commentObject(value, [
      'id',
      'discussionId',
      'nodeId',
      'target',
      'title',
      'slug',
      'classification',
      'at',
      'readAt',
    ]);
    const { at, readAt, ...target } = item;
    const createdAt = notificationTimestamp(at);
    const read = readAt === null ? null : notificationTimestamp(readAt, 1);
    if (read !== null && read < createdAt)
      throw new PublicCommentInputError('Invalid notification read time');
    return {
      ...mentionNotificationTarget(target),
      at: createdAt,
      readAt: read,
    };
  });
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    (!row['enabled'] && (items.length || next))
  )
    throw new PublicCommentInputError('Inconsistent notification page');
  return {
    enabled: row['enabled'],
    items,
    next: next ? `${next.at}.${next.id}` : null,
  };
}
