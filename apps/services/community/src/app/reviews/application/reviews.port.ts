import type { ReviewReportPage } from '@sdk/features/review/core';
import type { ReviewPage, MemberReview } from '@domains/community';

export type {
  ReviewActor,
  ReviewRecord,
  ReviewCommand,
  ReviewTransaction,
  ReviewReader,
  ReviewSnapshot,
  ReviewIdentifiers,
} from '@sdk/features/review/libs/management';
import type {
  ReviewReader,
  ReviewSnapshot,
  ReviewTransaction,
} from '@sdk/features/review/libs/management';

export interface ReviewScope {
  tenantId: string;
  applicationId: string;
}
export interface ReviewsRepository {
  transaction<T>(
    scope: ReviewScope,
    actorId: string,
    work: (tx: ReviewTransaction) => Promise<T>,
    reviewId?: string | null
  ): Promise<T>;
  page(
    scope: ReviewScope,
    reader: ReviewReader,
    cursor: string | null,
    moderation: boolean
  ): Promise<ReviewSnapshot<ReviewPage>>;
  read(
    scope: ReviewScope,
    reader: ReviewReader,
    id: string
  ): Promise<ReviewSnapshot<MemberReview | null>>;
  reports(
    scope: ReviewScope,
    id: string,
    cursor: string | null
  ): Promise<ReviewSnapshot<ReviewReportPage>>;
  summary(scope: ReviewScope): Promise<ReviewSnapshot<ReviewPage['summary']>>;
  revision(scope: ReviewScope): Promise<number>;
}
export interface ReviewTargets {
  visible(applicationId: string, tenantId: string): Promise<boolean>;
}
