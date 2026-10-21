import {
  applicationReviewTarget,
  bindApplicationReview,
  bindApplicationReviewPage,
} from '@domains/community';
import type {
  ReviewsRepository as BoundReviewsRepository,
  ReviewReader,
  ReviewScope,
  ReviewTransaction,
} from '@sdk/features/review/libs/management';
import type { ReviewsRepository } from './reviews.port';

const storedScope = (scope: ReviewScope) => ({
  tenantId: scope.tenantId,
  applicationId: applicationReviewTarget(scope.bindingKey),
});

/** Preserve the canonical Wapps tables, locks, journal and command fingerprint scope. */
export class ApplicationReviewRepository implements BoundReviewsRepository {
  constructor(private readonly repository: ReviewsRepository) {}

  transaction<T>(
    scope: ReviewScope,
    actorId: string,
    work: (tx: ReviewTransaction) => Promise<T>,
    id?: string | null
  ) {
    return this.repository.transaction(storedScope(scope), actorId, work, id);
  }

  async page(
    scope: ReviewScope,
    reader: ReviewReader,
    cursor: string | null,
    moderation: boolean
  ) {
    const snapshot = await this.repository.page(
      storedScope(scope),
      reader,
      cursor,
      moderation
    );
    return { ...snapshot, value: bindApplicationReviewPage(snapshot.value) };
  }

  async read(scope: ReviewScope, reader: ReviewReader, id: string) {
    const snapshot = await this.repository.read(storedScope(scope), reader, id);
    return {
      ...snapshot,
      value: snapshot.value && bindApplicationReview(snapshot.value),
    };
  }

  reports(scope: ReviewScope, id: string, cursor: string | null) {
    return this.repository.reports(storedScope(scope), id, cursor);
  }

  summary(scope: ReviewScope) {
    return this.repository.summary(storedScope(scope));
  }

  revision(scope: ReviewScope) {
    return this.repository.revision(storedScope(scope));
  }
}
