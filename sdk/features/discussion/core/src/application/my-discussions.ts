import {
  commentObject,
  publicCommentId,
  PublicCommentInputError,
} from './public-comment';

export interface MyDiscussion {
  id: string;
  applicationId: string;
  title: string;
  createdAt: number;
  replyCount: number;
  participation: 'author' | 'participant';
}

export interface MyDiscussionPage {
  items: MyDiscussion[];
  next: string | null;
}

export interface MyDiscussionCursor {
  at: number;
  id: string;
}

export function myDiscussionCursor(input: unknown): MyDiscussionCursor {
  if (typeof input !== 'string' || input.length > 53)
    throw new PublicCommentInputError('Invalid discussion cursor');
  const [at, id, extra] = input.split('.');
  if (
    extra !== undefined ||
    !/^(0|[1-9]\d{0,15})$/.test(at) ||
    !Number.isSafeInteger(Number(at))
  )
    throw new PublicCommentInputError('Invalid discussion cursor');
  return { at: Number(at), id: publicCommentId(id) };
}

export function parseMyDiscussionPage(input: unknown): MyDiscussionPage {
  const page = commentObject(input, ['items', 'next']);
  if (!Array.isArray(page['items']) || page['items'].length > 10)
    throw new PublicCommentInputError('Invalid discussion page');
  const next = page['next'];
  if (next !== null && typeof next !== 'string')
    throw new PublicCommentInputError('Invalid discussion cursor');
  if (next !== null) myDiscussionCursor(next);
  const items = page['items'].map((input): MyDiscussion => {
    const item = commentObject(input, [
      'id',
      'applicationId',
      'title',
      'createdAt',
      'replyCount',
      'participation',
    ]);
    const title = item['title'],
      createdAt = item['createdAt'],
      replyCount = item['replyCount'],
      participation = item['participation'];
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title !== title.trim() ||
      title.length > 120 ||
      Array.from(title).some(
        (value) => value.charCodeAt(0) < 32 || value.charCodeAt(0) === 127
      ) ||
      typeof createdAt !== 'number' ||
      !Number.isSafeInteger(createdAt) ||
      createdAt < 0 ||
      typeof replyCount !== 'number' ||
      !Number.isSafeInteger(replyCount) ||
      replyCount < 0 ||
      replyCount > 1999 ||
      (participation !== 'author' && participation !== 'participant')
    )
      throw new PublicCommentInputError('Invalid discussion entry');
    return {
      id: publicCommentId(item['id']),
      applicationId: publicCommentId(item['applicationId']),
      title,
      createdAt,
      replyCount,
      participation,
    };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new PublicCommentInputError('Duplicate discussion entry');
  return { items, next };
}
