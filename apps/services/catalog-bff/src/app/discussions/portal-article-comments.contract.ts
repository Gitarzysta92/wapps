import {
  commentObject,
  publicCommentContent,
  publicCommentId,
  type PublicComment,
  type PublicCommentThread,
} from '@domains/community';
import { discussionInteger } from './portal-discussions.contract';

export function articleCommentCursor(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,16}\.[0-9a-f-]{36}$/.test(value))
    throw new Error('Invalid comment cursor');
  const [at, id] = value.split('.');
  return { at: discussionInteger(Number(at)), id: publicCommentId(id) };
}

function comment(input: unknown): PublicComment {
  const row = commentObject(input, [
    'id',
    'parentId',
    'depth',
    'content',
    'createdAt',
    'updatedAt',
    'editable',
    'removable',
  ]);
  const depth = discussionInteger(row.depth);
  if (
    depth > 64 ||
    typeof row.editable !== 'boolean' ||
    typeof row.removable !== 'boolean'
  )
    throw new Error('Invalid comment');
  const result: PublicComment = {
    id: publicCommentId(row.id),
    parentId: row.parentId === null ? null : publicCommentId(row.parentId),
    depth,
    content: row.content === null ? null : publicCommentContent(row.content),
    createdAt: row.createdAt === null ? null : discussionInteger(row.createdAt),
    updatedAt: row.updatedAt === null ? null : discussionInteger(row.updatedAt),
    editable: row.editable,
    removable: row.removable,
  };
  if (
    (result.content && result.createdAt === null) ||
    (!result.content &&
      (result.createdAt !== null ||
        result.updatedAt !== null ||
        result.editable ||
        result.removable))
  )
    throw new Error('Invalid removed comment');
  return result;
}

export function articleCommentThread(
  input: unknown,
  rootOnly: boolean
): PublicCommentThread {
  const row = commentObject(input, [
    'id',
    'revision',
    'replyCount',
    'comments',
  ]);
  if (
    !Array.isArray(row.comments) ||
    !row.comments.length ||
    row.comments.length > (rootOnly ? 1 : 2000)
  )
    throw new Error('Invalid comment thread');
  const id = publicCommentId(row.id),
    comments = row.comments.map(comment);
  const root = comments[0];
  if (
    !root.content ||
    root.id !== id ||
    root.parentId !== null ||
    root.depth !== 0 ||
    new Set(comments.map((node) => node.id)).size !== comments.length
  )
    throw new Error('Invalid comment root');
  const nodes = new Map(comments.map((node) => [node.id, node]));
  if (
    comments
      .slice(1)
      .some(
        (node) =>
          !node.parentId || nodes.get(node.parentId)?.depth !== node.depth - 1
      )
  )
    throw new Error('Invalid comment ancestry');
  const replyCount = discussionInteger(row.replyCount);
  if (replyCount > 1999 || (!rootOnly && replyCount !== comments.length - 1))
    throw new Error('Invalid comment reply count');
  return {
    id,
    revision: discussionInteger(row.revision, 1),
    replyCount,
    comments,
  };
}

export function articleCommentPage(input: unknown) {
  const row = commentObject(input, ['items', 'next']);
  if (
    !Array.isArray(row.items) ||
    row.items.length > 10 ||
    !(row.next === null || typeof row.next === 'string')
  )
    throw new Error('Invalid comment page');
  const items = row.items.map((item) => articleCommentThread(item, true));
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error('Duplicate comment thread');
  if (row.next !== null) {
    const cursor = articleCommentCursor(row.next),
      last = items[9];
    if (
      !last ||
      cursor.id !== last.id ||
      cursor.at !== last.comments[0].createdAt
    )
      throw new Error('Invalid comment continuation');
  }
  return { items, next: row.next };
}
