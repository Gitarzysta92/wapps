import { applicationReviewKey } from '@domains/community';

export function reviewOwnerPath(
  applicationId: string,
  suffix = '',
  cursor?: string
): `/api/reviews${string}` {
  const query = new URLSearchParams({
    bindingKey: applicationReviewKey(applicationId),
  });
  if (cursor !== undefined) query.set('cursor', cursor);
  return `/api/reviews${suffix}?${query}`;
}
