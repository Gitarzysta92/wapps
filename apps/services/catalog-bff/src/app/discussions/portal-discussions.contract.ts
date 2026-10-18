import {
  applicationDiscussionCursor,
  commentObject,
  discussionVoteState,
  publicCommentId,
  publicDiscussionReply,
  publicDiscussionTopic,
  type PublicApplicationDiscussion,
  type PublicComment,
} from '@domains/community';

export function discussionInteger(value: unknown, minimum = 0): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new Error('Invalid discussion integer');
  return value;
}

function time(value: unknown): number | null {
  return value === null ? null : discussionInteger(value);
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
    'votes',
  ]);
  const depth = discussionInteger(row.depth);
  if (
    depth > 64 ||
    typeof row.editable !== 'boolean' ||
    typeof row.removable !== 'boolean'
  )
    throw new Error('Invalid discussion comment');
  const result: PublicComment = {
    id: publicCommentId(row.id),
    parentId: row.parentId === null ? null : publicCommentId(row.parentId),
    depth,
    content: row.content === null ? null : publicDiscussionReply(row.content),
    createdAt: time(row.createdAt),
    updatedAt: time(row.updatedAt),
    editable: row.editable,
    removable: row.removable,
    votes: row.votes === null ? null : discussionVoteState(row.votes),
  };
  if (
    (result.content && (result.createdAt === null || result.votes === null)) ||
    (!result.content &&
      (result.createdAt !== null ||
        result.updatedAt !== null ||
        result.votes !== null ||
        result.editable ||
        result.removable))
  )
    throw new Error('Invalid removed discussion comment');
  return result;
}

export function discussionThread(
  input: unknown,
  rootOnly: boolean
): PublicApplicationDiscussion {
  const row = commentObject(input, [
    'id',
    'revision',
    'replyCount',
    'comments',
    'title',
    'tags',
    'pinned',
    'canPin',
  ]);
  if (
    typeof row.pinned !== 'boolean' ||
    typeof row.canPin !== 'boolean' ||
    !Array.isArray(row.comments) ||
    !row.comments.length ||
    row.comments.length > (rootOnly ? 1 : 2000)
  )
    throw new Error('Invalid discussion thread');
  const id = publicCommentId(row.id),
    comments = row.comments.map(comment);
  const root = comments[0];
  if (
    !root.content ||
    root.id !== id ||
    root.depth !== 0 ||
    root.parentId !== null ||
    new Set(comments.map((node) => node.id)).size !== comments.length
  )
    throw new Error('Invalid discussion root');
  const nodes = new Map(comments.map((node) => [node.id, node]));
  if (
    comments
      .slice(1)
      .some(
        (node) =>
          !node.parentId || nodes.get(node.parentId)?.depth !== node.depth - 1
      )
  )
    throw new Error('Invalid discussion ancestry');
  const replyCount = discussionInteger(row.replyCount);
  if (replyCount > 1999 || (!rootOnly && replyCount !== comments.length - 1))
    throw new Error('Invalid discussion reply count');
  const { title, tags } = publicDiscussionTopic({
    ...root.content,
    title: row.title,
    tags: row.tags,
  });
  return {
    id,
    revision: discussionInteger(row.revision, 1),
    replyCount,
    comments,
    title,
    tags,
    pinned: row.pinned,
    canPin: row.canPin,
  };
}

export function discussionPage(input: unknown) {
  const row = commentObject(input, ['items', 'next']);
  if (
    !Array.isArray(row.items) ||
    row.items.length > 10 ||
    !(row.next === null || typeof row.next === 'string')
  )
    throw new Error('Invalid discussion page');
  const items = row.items.map((item) => discussionThread(item, true));
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new Error('Duplicate discussion topic');
  if (row.next !== null) {
    const cursor = applicationDiscussionCursor(row.next),
      last = items[9];
    if (
      !last ||
      cursor.id !== last.id ||
      cursor.at !== last.comments[0].createdAt ||
      cursor.pinned !== last.pinned
    )
      throw new Error('Invalid discussion continuation');
  }
  return { items, next: row.next };
}

export function discussionReceipt(input: unknown) {
  const row = commentObject(input, [
    'id',
    'discussionId',
    'revision',
    'projection',
  ]);
  if (row.projection !== 'pending')
    throw new Error('Invalid discussion receipt');
  return {
    id: publicCommentId(row.id),
    discussionId: publicCommentId(row.discussionId),
    revision: discussionInteger(row.revision, 1),
    projection: 'pending' as const,
  };
}
