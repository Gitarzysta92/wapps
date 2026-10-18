import {
  memberReview,
  reviewPage,
  reviewId,
  ReviewMissingError,
  type MemberReview as BoundReview,
  type ReviewPage as BoundReviewPage,
} from '@sdk/features/review/core';
import type { MemberReview, ReviewPage } from './application-review';

const prefix = 'wapps:application:';

export function applicationReviewKey(applicationId: string): string {
  return prefix + reviewId(applicationId);
}

/** Only Wapps interprets this key; historical SQL continues to store the UUID. */
export function applicationReviewTarget(bindingKey: string): string {
  if (!bindingKey.startsWith(prefix))
    throw new ReviewMissingError('Review context not found');
  try {
    return reviewId(bindingKey.slice(prefix.length));
  } catch {
    throw new ReviewMissingError('Review context not found');
  }
}

export function bindApplicationReview(review: MemberReview): BoundReview {
  const { applicationId, ...fields } = review;
  return { ...fields, bindingKey: applicationReviewKey(applicationId) };
}

export function bindApplicationReviewPage(page: ReviewPage): BoundReviewPage {
  return {
    ...page,
    items: page.items.map(bindApplicationReview),
    mine: page.mine && bindApplicationReview(page.mine),
  };
}

export function applicationReviewFromBinding(
  input: unknown,
  applicationId: string
): MemberReview {
  const { bindingKey, ...fields } = memberReview(
    input,
    applicationReviewKey(applicationId)
  );
  return { ...fields, applicationId: applicationReviewTarget(bindingKey) };
}

export function applicationReviewPageFromBinding(
  input: unknown,
  applicationId: string,
  moderation = false
): ReviewPage {
  const page = reviewPage(
    input,
    applicationReviewKey(applicationId),
    moderation
  );
  return {
    ...page,
    items: page.items.map((item) =>
      applicationReviewFromBinding(item, applicationId)
    ),
    mine: page.mine && applicationReviewFromBinding(page.mine, applicationId),
  };
}
