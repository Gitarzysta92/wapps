import type { AccountErasureRequest } from '@sdk/features/identity/core';

/** Private SQL state only; drained never acknowledges service-wide erasure. */
export interface DiscussionPrivateErasure {
  advance(request: AccountErasureRequest): Promise<'pending' | 'drained'>;
}
