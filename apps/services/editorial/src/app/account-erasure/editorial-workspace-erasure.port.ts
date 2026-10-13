import type { AccountErasureRequest } from '@sdk/features/identity/core';

export type EditorialWorkspaceErasureState =
  | 'pending'
  | 'media-pending'
  | 'drained';

/** Private authoring data only; ownership audits and public projections are separate prerequisites. */
export interface EditorialWorkspaceErasure {
  advance(
    request: AccountErasureRequest
  ): Promise<EditorialWorkspaceErasureState>;
}
