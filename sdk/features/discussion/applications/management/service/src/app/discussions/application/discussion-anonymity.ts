import type { DiscussionTarget } from '@sdk/features/discussion/core';

export const ANONYMOUS_DISCUSSION_NAME = 'Deleted account';

/** Retain authored content, but never keep legacy envelope metadata or structured attribution. */
export function anonymousDiscussionPayload(payload: unknown): {
  content: unknown;
} {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !Object.prototype.hasOwnProperty.call(payload, 'content')
  )
    throw new Error('Missing canonical Discussion content');
  const content: unknown = Reflect.get(payload, 'content');
  if (!content || typeof content !== 'object' || Array.isArray(content))
    return { content };
  const retained = { ...content };
  Reflect.deleteProperty(retained, 'displayName');
  return { content: retained };
}

/** Supply the public label at presentation time, keeping stored copies within existing byte bounds. */
export function presentAnonymousDiscussionPayload(
  payload: unknown,
  target: DiscussionTarget | null | undefined
): { content: unknown } {
  const result = anonymousDiscussionPayload(payload);
  return target &&
    result.content &&
    typeof result.content === 'object' &&
    !Array.isArray(result.content)
    ? { content: { ...result.content, displayName: ANONYMOUS_DISCUSSION_NAME } }
    : result;
}
