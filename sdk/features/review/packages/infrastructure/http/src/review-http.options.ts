import type { Request } from 'express';
import type {
  Reviews,
  ReviewActor,
} from '@sdk/features/review/libs/management';

export const REVIEW_HTTP_OPTIONS = Symbol('REVIEW_HTTP_OPTIONS');

export interface ReviewHttpOptions {
  reviews: Pick<Reviews, 'summary' | 'page' | 'read' | 'reports' | 'change'>;
  /** The host resolves identity only after authenticating trusted request provenance. */
  actor(request: Request, required: boolean): ReviewActor | null;
  error?(error: unknown): unknown;
}
