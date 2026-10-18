import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';
import {
  commentObject,
  publicCommentId,
  PublicCommentInputError,
} from './public-comment';

export const PROFILE_DISCUSSIONS_PAGE_SIZE = 10;
export interface ProfileDiscussion extends ClassifiedContent {
  id: string;
  parentKind: 'application' | 'article';
  parentId: string;
  parentSlug: string;
  title: string;
  createdAt: number;
  replyCount: number;
  participation: 'author' | 'participant';
}
export interface ProfileDiscussionsPage {
  sharing: 'visible' | 'hidden';
  items: ProfileDiscussion[];
  after: string | null;
}

/** Continuations are authenticated ciphertext; only Discussion interprets them. */
export function profileDiscussionsCursor(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^v1\.[A-Za-z0-9_-]{40,196}$/.test(value))
    throw new PublicCommentInputError('Invalid shared discussion cursor');
  return value;
}

export function parseProfileDiscussionsPage(
  input: unknown
): ProfileDiscussionsPage {
  const page = commentObject(input, ['sharing', 'items', 'after']);
  if (
    (page['sharing'] !== 'visible' && page['sharing'] !== 'hidden') ||
    !Array.isArray(page['items']) ||
    page['items'].length > PROFILE_DISCUSSIONS_PAGE_SIZE
  )
    throw new PublicCommentInputError('Invalid shared discussion page');
  const after = profileDiscussionsCursor(page['after']);
  const items = page['items'].map((input): ProfileDiscussion => {
    const row = commentObject(input, [
      'id',
      'parentKind',
      'parentId',
      'parentSlug',
      'title',
      'createdAt',
      'replyCount',
      'participation',
      'classification',
    ]);
    const parentKind = row['parentKind'],
      parentSlug = row['parentSlug'],
      title = row['title'],
      createdAt = row['createdAt'],
      replyCount = row['replyCount'],
      participation = row['participation'];
    if (
      (parentKind !== 'application' && parentKind !== 'article') ||
      typeof parentSlug !== 'string' ||
      parentSlug.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parentSlug) ||
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim() !== title ||
      title.length > 160 ||
      [...title].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
      typeof createdAt !== 'number' ||
      !Number.isSafeInteger(createdAt) ||
      createdAt < 0 ||
      typeof replyCount !== 'number' ||
      !Number.isSafeInteger(replyCount) ||
      replyCount < 0 ||
      replyCount > 1999 ||
      (participation !== 'author' && participation !== 'participant')
    )
      throw new PublicCommentInputError('Invalid shared discussion');
    return {
      id: publicCommentId(row['id']),
      parentId: publicCommentId(row['parentId']),
      parentKind,
      parentSlug,
      title,
      createdAt,
      replyCount,
      participation,
      ...classificationFields(row['classification']),
    };
  });
  if (
    (page['sharing'] === 'hidden' && (items.length || after !== null)) ||
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.some(
      (item, index) =>
        index > 0 &&
        (items[index - 1].createdAt < item.createdAt ||
          (items[index - 1].createdAt === item.createdAt &&
            items[index - 1].id >= item.id))
    )
  )
    throw new PublicCommentInputError('Invalid shared discussion order');
  return { sharing: page['sharing'], items, after };
}
