import {
  commentObject,
  publicCommentId,
  PublicCommentInputError,
} from './public-comment';

export const DISCUSSION_SELECTION_LIMIT = 50;

export interface DiscussionSelectionItem {
  id: string;
  applicationId: string;
  revision: number;
  title: string;
  replyCount: number;
}
export interface DiscussionSelection {
  items: DiscussionSelectionItem[];
}

export function discussionSelectionIds(input: unknown): string[] {
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.length > DISCUSSION_SELECTION_LIMIT
  )
    throw new PublicCommentInputError('Choose one to fifty discussion IDs');
  const ids = input.map(publicCommentId);
  if (new Set(ids).size !== ids.length)
    throw new PublicCommentInputError('Discussion IDs must be distinct');
  return ids;
}

export function discussionSelectionQuery(input: unknown): string[] {
  const value = commentObject(input, ['ids'])['ids'];
  if (
    typeof value !== 'string' ||
    value.length > DISCUSSION_SELECTION_LIMIT * 37 - 1
  )
    throw new PublicCommentInputError('Invalid discussion selection');
  return discussionSelectionIds(value.split(','));
}

export function parseDiscussionSelection(
  input: unknown,
  requested: string[]
): DiscussionSelection {
  const ids = discussionSelectionIds(requested);
  const values = commentObject(input, ['items'])['items'];
  if (!Array.isArray(values) || values.length > ids.length)
    throw new PublicCommentInputError('Invalid discussion selection');
  const items = values.map((value): DiscussionSelectionItem => {
    const row = commentObject(value, [
      'id',
      'applicationId',
      'revision',
      'title',
      'replyCount',
    ]);
    const id = publicCommentId(row['id']);
    const applicationId = publicCommentId(row['applicationId']);
    const revision = row['revision'],
      title = row['title'],
      replyCount = row['replyCount'];
    if (
      !ids.includes(id) ||
      typeof revision !== 'number' ||
      !Number.isSafeInteger(revision) ||
      revision < 1 ||
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim() !== title ||
      title.length > 120 ||
      Array.from(title).some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
      ) ||
      typeof replyCount !== 'number' ||
      !Number.isSafeInteger(replyCount) ||
      replyCount < 0 ||
      replyCount > 1999
    )
      throw new PublicCommentInputError('Invalid selected discussion');
    return { id, applicationId, revision, title, replyCount };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new PublicCommentInputError('Duplicate selected discussion');
  return { items };
}
