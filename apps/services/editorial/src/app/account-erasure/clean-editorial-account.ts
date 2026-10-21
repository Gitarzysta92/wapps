import {
  accountErasureRequest,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import type { AccountErasureCleanup } from '@sdk/features/identity/libs/management';
import type { EditorialContributionErasure } from './editorial-contribution-erasure.port';
import type { EditorialWorkspaceErasure } from './editorial-workspace-erasure.port';
import type { EditorialAuditErasure } from './editorial-audit-erasure.port';

export interface EditorialErasureCompletion {
  state(request: AccountErasureRequest): Promise<'pending' | 'completed'>;
  /** Recheck residual SQL authority and record the exact completion receipt in one transaction. */
  complete(request: AccountErasureRequest): Promise<'pending' | 'completed'>;
}

export class CleanEditorialAccount implements AccountErasureCleanup {
  constructor(
    private readonly contributions: EditorialContributionErasure,
    private readonly workspace: EditorialWorkspaceErasure,
    private readonly audit: EditorialAuditErasure,
    private readonly projections: {
      advance(request: AccountErasureRequest): Promise<'pending' | 'drained'>;
    },
    private readonly completion: EditorialErasureCompletion,
    private readonly oldWritersFenced: boolean
  ) {}

  async advance(
    input: AccountErasureRequest
  ): Promise<'pending' | 'completed'> {
    const request = accountErasureRequest(input);
    if ((await this.completion.state(request)) === 'completed')
      return 'completed';
    if (!this.oldWritersFenced) return 'pending';
    try {
      if (await this.contributions.advance(request)) return 'pending';
      if ((await this.workspace.advance(request)) !== 'drained')
        return 'pending';
      if ((await this.audit.advance(request)) !== 'drained') return 'pending';
      if ((await this.projections.advance(request)) !== 'drained')
        return 'pending';
      return await this.completion.complete(request);
    } catch (error) {
      // Another request can finish while this one awaits Mongo or a cleanup transaction.
      if ((await this.completion.state(request)) === 'completed')
        return 'completed';
      throw error;
    }
  }
}
