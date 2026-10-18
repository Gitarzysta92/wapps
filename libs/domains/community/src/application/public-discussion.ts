import {
  commentObject,
  publicCommentContent,
  publicDiscussionReply,
  PublicCommentInputError,
  type DiscussionTarget,
  type PublicCommentContent,
  type PublicCommentThread,
} from './public-comment';

export interface PublicDiscussionTopic extends PublicCommentContent {
  title: string;
  tags: string[];
}

export interface PublicApplicationDiscussion extends PublicCommentThread {
  title: string;
  tags: string[];
  pinned: boolean;
  canPin: boolean;
}

export interface PublicApplicationDiscussionPage {
  items: PublicApplicationDiscussion[];
  next: string | null;
}

function line(input: unknown, maximum: number, field: string): string {
  if (
    typeof input !== 'string' ||
    !input.trim() ||
    input.length > maximum ||
    Array.from(input).some(
      (value) => value.charCodeAt(0) < 32 || value.charCodeAt(0) === 127
    )
  )
    throw new PublicCommentInputError(
      `Choose ${field} of 1 to ${maximum} characters on one line`
    );
  return input.trim();
}

export function publicDiscussionTopic(input: unknown): PublicDiscussionTopic {
  const value = commentObject(input, [
    'title',
    'text',
    'displayName',
    'tags',
    'mentions',
  ]);
  const title = line(value['title'], 120, 'a discussion title');
  const content = publicDiscussionReply({
    displayName: value['displayName'],
    text: value['text'],
    mentions: value['mentions'],
  });
  const inputTags = value['tags'] ?? [];
  if (!Array.isArray(inputTags) || inputTags.length > 8)
    throw new PublicCommentInputError('Choose up to eight discussion tags');
  const tags = inputTags.map((tag) => line(tag, 40, 'a tag').toLowerCase());
  if (new Set(tags).size !== tags.length)
    throw new PublicCommentInputError('Discussion tags must be distinct');
  return { title, ...content, tags };
}

/** Root and reply payloads have distinct schemas; a binding never comes from payload content. */
export function boundDiscussionContent(
  target: DiscussionTarget,
  kind: 'discussion' | 'comment',
  value: unknown
): PublicCommentContent | PublicDiscussionTopic {
  return target.kind === 'article'
    ? publicCommentContent(value)
    : kind === 'discussion'
    ? publicDiscussionTopic(value)
    : publicDiscussionReply(value);
}
