import type { AccountErasureRequest } from '@sdk/features/identity/core';

export interface EditorialContributionErasure {
  /** Anonymize at most one canonical resource and retain its projection cleanup target. */
  advance(request: AccountErasureRequest): Promise<boolean>;
}
