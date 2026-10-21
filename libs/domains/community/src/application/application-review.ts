import {
  reviewId,
  reviewObject,
  memberReview as boundReview,
  reviewPage as boundReviewPage,
  type MemberReview as BoundReview,
  type ReviewPage as BoundReviewPage,
} from '@sdk/features/review/core';

export interface MemberReview extends Omit<BoundReview, 'bindingKey'> {
  applicationId: string;
}
export interface ReviewPage extends Omit<BoundReviewPage, 'items' | 'mine'> {
  items: MemberReview[];
  mine: MemberReview | null;
}

// Preserve the public contract and historical SQL IDs at the consumer boundary.
function bind(input: unknown) {
  const row = reviewObject(input, [
    'id',
    'applicationId',
    'revision',
    'contentRevision',
    'content',
    'withdrawn',
    'hidden',
    'moderationReason',
    'createdAt',
    'updatedAt',
    'helpfulCount',
    'helpful',
    'reported',
    'mine',
    'canModerate',
    'openReports',
  ]);
  const { applicationId, ...review } = row;
  return { ...review, bindingKey: reviewId(applicationId) };
}
function unbind(review: BoundReview): MemberReview {
  const { bindingKey, ...fields } = review;
  return { ...fields, applicationId: bindingKey };
}
export function memberReview(
  input: unknown,
  applicationId: string
): MemberReview {
  return unbind(boundReview(bind(input), reviewId(applicationId)));
}
export function reviewPage(
  input: unknown,
  applicationId: string,
  moderation = false
): ReviewPage {
  const row = reviewObject(input, [
    'items',
    'next',
    'summary',
    'mine',
    'canModerate',
  ]);
  const page = boundReviewPage(
    {
      ...row,
      items: Array.isArray(row['items'])
        ? row['items'].map(bind)
        : row['items'],
      mine: row['mine'] === null ? null : bind(row['mine']),
    },
    reviewId(applicationId),
    moderation
  );
  return {
    ...page,
    items: page.items.map(unbind),
    mine: page.mine && unbind(page.mine),
  };
}
