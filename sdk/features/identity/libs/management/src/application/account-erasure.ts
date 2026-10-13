import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import {
  ACCOUNT_ERASURE_PARTICIPANTS,
  accountErasureRequest,
  accountErasureReceipt,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityUnavailable,
  type AccountErasureParticipantName,
  type AccountErasureRequest,
  type AccountErasureReceipt,
} from '@sdk/features/identity/core';

export const ACCOUNT_ERASURE_WRITER = 'wapps-account-erasure-writer';
export const ACCOUNT_ERASURE_WRITER_ROLE = 'account-erasure:writer';
export const ACCOUNT_ERASURE_WRITER_SCOPE = 'account-erasure';

export interface AccountErasureParticipant {
  readonly name: AccountErasureParticipantName;
  request(input: AccountErasureRequest): Promise<AccountErasureReceipt>;
}

/** Owning services durably accept work; only completed participant receipts finish erasure. */
export class RequestAccountErasure {
  constructor(
    private readonly participants: readonly AccountErasureParticipant[]
  ) {
    if (
      participants.length !== ACCOUNT_ERASURE_PARTICIPANTS.length ||
      ACCOUNT_ERASURE_PARTICIPANTS.some(
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

export class AccountErasureAccess {
  constructor(
    private readonly participant: AccountErasureParticipant,
    private readonly policy: IPolicyEvaluator
  ) {
    if (participant.name === 'account')
      throw new Error('Account erasure is not remotely writable');
  }
  async request(
    input: unknown,
    actor: { identityId: string; tenantId: string; roles: readonly string[] }
  ) {
    if (
      actor.identityId !== ACCOUNT_ERASURE_WRITER ||
      actor.tenantId !== ACCOUNT_ERASURE_WRITER_SCOPE ||
      actor.roles.length !== 1 ||
      actor.roles[0] !== ACCOUNT_ERASURE_WRITER_ROLE
    )
      throw new CanonicalIdentityAccessDenied(
        'Account erasure service access required'
      );
    const request = accountErasureRequest(input);
    const action = `${this.participant.name}.account-erasure.request`;
    const decision = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: actor.tenantId,
      timestamp: Date.now(),
      action,
      actionName: action,
      subject: { roles: [...actor.roles] },
      resource: {
        type: 'account-erasure',
        id: request.identityId,
        tenantId: ACCOUNT_ERASURE_WRITER_SCOPE,
      },
    });
    if (!decision.ok)
      throw new CanonicalIdentityUnavailable(
        'Account erasure authorization unavailable'
      );
    if (decision.value !== true)
      throw new CanonicalIdentityAccessDenied('Account erasure access denied');
    return this.participant.request(request);
  }
}
