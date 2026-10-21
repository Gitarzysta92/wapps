import type {
  ReviewChange,
  ReviewContent,
  ReviewReceipt,
  ReviewReportPage,
  ReviewState,
  ReviewPage,
  MemberReview,
} from '@sdk/features/review/core';

export interface ReviewActor {
  identityId: string;
  tenantId: string;
  roles: string[];
}
export interface ReviewScope {
  tenantId: string;
  bindingKey: string;
}
export interface ReviewRecord extends ReviewState {
  id: string;
  ownerId: string | null;
  content: ReviewContent;
  createdAt: number;
  updatedAt: number;
}
export interface ReviewCommand {
  actorId: string;
  key: string;
  fingerprint: string;
}
export interface ReviewTransaction {
  receipt(command: ReviewCommand): Promise<ReviewReceipt | null>;
  own(actorId: string): Promise<ReviewRecord | null>;
  find(id: string): Promise<ReviewRecord | null>;
  commit(input: {
    record: ReviewRecord;
    change: ReviewChange;
    command: ReviewCommand;
    at: number;
  }): Promise<ReviewReceipt>;
}
export interface ReviewReader {
  actorId: string | null;
  moderator: boolean;
}
export interface ReviewSnapshot<T> {
  value: T;
  revision: number;
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
export type ReviewAction = ReviewChange['type'] | 'read';
export interface ReviewAuthority {
  visible(scope: ReviewScope): Promise<boolean>;
  authorize(
    scope: ReviewScope,
    actor: ReviewActor | null,
    action: ReviewAction
  ): Promise<{ allowed: boolean; moderator: boolean }>;
}
export interface ReviewIdentifiers {
  next(): string;
  fingerprint(value: string): string;
}
