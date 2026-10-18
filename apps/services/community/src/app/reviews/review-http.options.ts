import type { ReviewHttpOptions } from '@sdk/features/review/http';
import { ReviewDeniedError } from '@sdk/features/review/core';
import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import {
  extractAuthUser,
  type AuthenticatedRequest,
} from '../decorators/auth-user.decorator';
import { discussionActor } from '../discussions/discussion-actor';
import type { ApplicationReviews } from './application/application-reviews';

export function communityReviewHttp(
  reviews: ApplicationReviews
): ReviewHttpOptions {
  return {
    reviews: reviews.capability,
    actor: (request, required) =>
      discussionActor(
        extractAuthUser(request as AuthenticatedRequest, !required)
      ),
    error: (error) =>
      error instanceof CanonicalIdentityAccessDenied
        ? new ReviewDeniedError('Review access denied')
        : error,
  };
}
