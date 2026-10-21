import type { AccountErasureRequest } from '@sdk/features/identity/core';

export interface ReviewErasure {
  /** Review authority is SQL-only; drained does not complete the Discussion participant. */
  advance(request: AccountErasureRequest): Promise<'pending' | 'drained'>;
}
