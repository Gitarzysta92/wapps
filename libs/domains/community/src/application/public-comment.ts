import { discussionMentionProfiles } from './discussion-mention';

export interface DiscussionTarget {
  kind: 'article' | 'application';
  id: string;
}

export interface PublicCommentContent {
  displayName: string;
  text: string;
  mentions?: string[];
}

export class PublicCommentInputError extends Error {}

function hasControlCharacters(value: string, multiline: boolean): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return (
      code === 127 || (code < 32 && !(multiline && [9, 10, 13].includes(code)))
    );
  });
}

export function publicCommentId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    )
  )
    throw new PublicCommentInputError(
      'A canonical comment or article ID is required'
    );
  return value;
}

export function discussionTarget(value: unknown): DiscussionTarget {
  const input = commentObject(value, ['kind', 'id']);
  if (input['kind'] !== 'article' && input['kind'] !== 'application')
    throw new PublicCommentInputError('Unsupported discussion target');
  return { kind: input['kind'], id: publicCommentId(input['id']) };
}

export function commentObject(
  value: unknown,
  keys: string[]
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new PublicCommentInputError('Invalid comment fields');
  return value as Record<string, unknown>;
}

export function publicCommentContent(value: unknown): PublicCommentContent {
  return publicTextContent(value, 4000);
}

export function publicDiscussionReply(value: unknown): PublicCommentContent {
  return publicTextContent(value, 5000);
}

function publicTextContent(
  value: unknown,
  maximum: 4000 | 5000
): PublicCommentContent {
  const input = commentObject(value, ['displayName', 'text', 'mentions']);
  const text = input['text'],
    displayName = input['displayName'];
  if (
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > maximum ||
    hasControlCharacters(text, true)
  )
    throw new PublicCommentInputError(
      `Write a comment of 1 to ${
        maximum === 4000 ? '4,000' : '5,000'
      } characters`
    );
  if (
    typeof displayName !== 'string' ||
    !displayName.trim() ||
    displayName.length > 80 ||
    hasControlCharacters(displayName, false)
  )
    throw new PublicCommentInputError(
      'Choose a public name of 1 to 80 characters'
    );
  const mentions =
    input['mentions'] === undefined
      ? []
      : discussionMentionProfiles(input['mentions']);
  return {
    displayName: displayName.trim(),
    text: text.trim(),
    ...(mentions.length ? { mentions } : {}),
  };
}

export interface PublicComment {
  /** Application topics expose canonical vote totals and only the current actor's choice. */
  votes?: import('./discussion-vote').DiscussionVoteState | null;
  id: string;
  parentId: string | null;
  depth: number;
  content: PublicCommentContent | null;
  createdAt: number | null;
  updatedAt: number | null;
  editable: boolean;
  removable: boolean;
}

export interface PublicCommentThread {
  id: string;
  revision: number;
  /** Includes redacted reply placeholders retained in the conversation. */
  replyCount: number;
  comments: PublicComment[];
}

export interface PublicCommentPage {
  items: PublicCommentThread[];
  next: string | null;
}
