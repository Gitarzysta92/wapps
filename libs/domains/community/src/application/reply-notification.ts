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

export const REPLY_NOTIFICATION_PAGE_SIZE = 10;
export const NOTIFICATION_WORKER_ID = 'wapps-notification-worker';
export const NOTIFICATION_WORKER_ROLE = 'notification:worker';
export const NOTIFICATION_WORKER_SCOPE = 'notifications';

/** One newly committed reply addressed to its immediate parent's author. */
export interface ReplyNotificationEvent {
  id: string;
  recipientId: string;
  discussionId: string;
  parentId: string;
  revision: number;
  at: number;
}

export interface ReplyNotificationLease {
  event: ReplyNotificationEvent;
  token: string;
  until: number;
}

export interface ReplyNotificationTarget extends ClassifiedContent {
  id: string;
  discussionId: string;
  target: DiscussionTarget;
  title: string;
  slug: string;
}

export interface ReplyInboxItem extends ReplyNotificationTarget {
  at: number;
  readAt: number | null;
}

export interface ReplyInboxPage {
  enabled: boolean;
  items: ReplyInboxItem[];
  next: string | null;
}

export function notificationInteger(value: unknown, minimum = 0): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new PublicCommentInputError('Invalid notification number');
  return value;
}

export function notificationTimestamp(value: unknown, minimum = 0): number {
  const at = notificationInteger(value, minimum);
  if (at > 8_640_000_000_000_000)
    throw new PublicCommentInputError('Invalid notification timestamp');
  return at;
}

export function notificationRecipient(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 128 ||
    value.trim() !== value ||
    [...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    throw new PublicCommentInputError('Invalid notification recipient');
  return value;
}

export function replyNotificationEvent(value: unknown): ReplyNotificationEvent {
  const row = commentObject(value, [
    'id',
    'recipientId',
    'discussionId',
    'parentId',
    'revision',
    'at',
  ]);
  const result = {
    id: publicCommentId(row['id']),
    recipientId: notificationRecipient(row['recipientId']),
    discussionId: publicCommentId(row['discussionId']),
    parentId: publicCommentId(row['parentId']),
    revision: notificationInteger(row['revision'], 2),
    at: notificationTimestamp(row['at']),
  };
  if (result.id === result.parentId || result.id === result.discussionId)
    throw new PublicCommentInputError('Invalid reply notification graph');
  return result;
}

export function replyNotificationLease(value: unknown): ReplyNotificationLease {
  const row = commentObject(value, ['event', 'token', 'until']);
  return {
    event: replyNotificationEvent(row['event']),
    token: publicCommentId(row['token']),
    until: notificationTimestamp(row['until'], 1),
  };
}

export function replyNotificationTarget(
  value: unknown
): ReplyNotificationTarget {
  const row = commentObject(value, [
    'id',
    'discussionId',
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
    target: discussionTarget(row['target']),
    ...classificationFields(row['classification']),
    title: row['title'],
    slug: row['slug'],
  };
}

export function replyInboxCursor(
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

export function replyInboxPage(value: unknown): ReplyInboxPage {
  const row = commentObject(value, ['enabled', 'items', 'next']);
  if (
    typeof row['enabled'] !== 'boolean' ||
    !Array.isArray(row['items']) ||
    row['items'].length > REPLY_NOTIFICATION_PAGE_SIZE
  )
    throw new PublicCommentInputError('Invalid notification page');
  if (row['next'] === undefined)
    throw new PublicCommentInputError('Missing notification cursor');
  const next = replyInboxCursor(row['next']);
  const items = row['items'].map((value) => {
    const item = commentObject(value, [
      'id',
      'discussionId',
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
    return { ...replyNotificationTarget(target), at: createdAt, readAt: read };
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
