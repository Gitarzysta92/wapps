import {
  applicationReviewKey,
  applicationReviewFromBinding,
  applicationReviewPageFromBinding,
} from '@domains/community';
import type { ReviewChange } from '@sdk/features/review/core';
import { Reviews } from '@sdk/features/review/libs/management';
import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import { ApplicationReviewRepository } from './application-review-repository';
import { ApplicationReviewAuthority } from './application-review-authority';
import type {
  ReviewActor,
  ReviewIdentifiers,
  ReviewsRepository,
  ReviewTargets,
} from './reviews.port';

/** Consumer facade for existing internal Wapps readers; HTTP uses the generic capability. */
export class ApplicationReviews {
  readonly capability: Reviews;

  constructor(
    repository: ReviewsRepository,
    targets: ReviewTargets,
    policy: IPolicyEvaluator,
    identifiers: ReviewIdentifiers,
    publicTenant: string,
    now: () => number = Date.now
  ) {
    this.capability = new Reviews(
      new ApplicationReviewRepository(repository),
      new ApplicationReviewAuthority(targets, policy, publicTenant, now),
      identifiers,
      publicTenant,
      now
    );
  }

  summary(applicationId: string, actor: ReviewActor | null) {
    return this.capability.summary(applicationReviewKey(applicationId), actor);
  }

  async page(
    applicationId: string,
    actor: ReviewActor | null,
    cursor: string | null,
    moderation = false
  ) {
    const page = await this.capability.page(
      applicationReviewKey(applicationId),
      actor,
      cursor,
      moderation
    );
    return applicationReviewPageFromBinding(page, applicationId, moderation);
  }

  async read(applicationId: string, id: string, actor: ReviewActor | null) {
    const review = await this.capability.read(
      applicationReviewKey(applicationId),
      id,
      actor
    );
    return applicationReviewFromBinding(review, applicationId);
  }

  reports(
    applicationId: string,
    id: string,
    actor: ReviewActor,
    cursor: string | null
  ) {
    return this.capability.reports(
      applicationReviewKey(applicationId),
      id,
      actor,
      cursor
    );
  }

  change(
    applicationId: string,
    id: string | null,
    type: ReviewChange['type'],
    body: unknown,
    actor: ReviewActor,
    key: string
  ) {
    return this.capability.change(
      applicationReviewKey(applicationId),
      id,
      type,
      body,
      actor,
      key
    );
  }
}
