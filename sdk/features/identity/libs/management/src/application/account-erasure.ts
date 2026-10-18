import {
  consumerProviderPlan,
  accountErasureRequest,
  accountErasureReceipt,
  CanonicalIdentityUnavailable,
  type AccountErasureParticipantName,
  type AccountErasureRequest,
  type AccountErasureReceipt,
} from '@sdk/features/identity/core';

export interface AccountErasureParticipant {
  readonly name: AccountErasureParticipantName;
  request(input: AccountErasureRequest): Promise<AccountErasureReceipt>;
}

/** Owning services durably accept work; only completed participant receipts finish erasure. */
export class RequestAccountErasure {
  constructor(
    private readonly participants: readonly AccountErasureParticipant[],
    required: readonly string[]
  ) {
    const plan = consumerProviderPlan(required);
    this.participants = Object.freeze(
      participants.map((participant) =>
        Object.freeze({
          name: participant.name,
          request: participant.request.bind(participant),
        })
      )
    );
    if (
      participants.length !== plan.length ||
      plan.some(
        (name) =>
          participants.filter((entry) => entry.name === name).length !== 1
      )
    )
      throw new Error(
        'Account erasure requires all owning services exactly once'
      );
  }
  async request(
    input: AccountErasureRequest
  ): Promise<'pending' | 'completed'> {
    const request = accountErasureRequest(input);
    // Reach every available service even if another service is unavailable.
    const results = await Promise.allSettled(
      this.participants.map(async (participant) => {
        const receipt = accountErasureReceipt(
          await participant.request(request)
        );
        if (
          receipt.participant !== participant.name ||
          receipt.identityId !== request.identityId ||
          receipt.revision !== request.revision
        )
          throw new CanonicalIdentityUnavailable(
            'Account erasure receipt does not match its request'
          );
        return receipt.state;
      })
    );
    if (results.some((result) => result.status === 'rejected'))
      throw new CanonicalIdentityUnavailable(
        'Account erasure participant unavailable'
      );
    return results.every(
      (result) => result.status === 'fulfilled' && result.value === 'completed'
    )
      ? 'completed'
      : 'pending';
  }
}
