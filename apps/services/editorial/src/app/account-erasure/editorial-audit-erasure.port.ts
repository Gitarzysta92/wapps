import type { AccountErasureRequest } from '@sdk/features/identity/core';

/** Private ownership/proof history and attribution; projection completion remains separate. */
export interface EditorialAuditErasure {
  advance(request: AccountErasureRequest): Promise<'pending' | 'drained'>;
}
