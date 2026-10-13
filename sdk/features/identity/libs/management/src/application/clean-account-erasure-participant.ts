import {
  accountErasureReceipt,
  accountErasureRequest,
  CanonicalIdentityUnavailable,
  type AccountErasureRequest,
} from '@sdk/features/identity/core';
import type { AccountErasureParticipant } from './account-erasure';

export interface AccountErasureCleanup {
  /** Advance bounded durable cleanup; completion includes every retained private record owned here. */
  advance(request: AccountErasureRequest): Promise<'pending' | 'completed'>;
}

export class CleanAccountErasureParticipant
  implements AccountErasureParticipant
{
  readonly name;
  constructor(
    private readonly participant: AccountErasureParticipant,
    private readonly cleanup: AccountErasureCleanup
  ) {
    this.name = participant.name;
  }
  async request(input: AccountErasureRequest) {
    const request = accountErasureRequest(input);
    const accepted = accountErasureReceipt(
      await this.participant.request(request)
    );
    if (
      accepted.participant !== this.name ||
      accepted.identityId !== request.identityId ||
      accepted.revision !== request.revision
    )
      throw new CanonicalIdentityUnavailable(
        'Account erasure receipt does not match cleanup'
      );
    if (accepted.state === 'completed') return accepted;
    const state = await this.cleanup.advance(request);
    return accountErasureReceipt({ ...accepted, state });
  }
}
