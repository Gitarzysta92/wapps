import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import {
  accountErasureRequest,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityUnavailable,
} from '@sdk/features/identity/core';
import {
  RequestAccountErasure as ErasureCoordinator,
  type AccountErasureParticipant,
} from '@sdk/features/identity/libs/management';
import { ACCOUNT_ERASURE_PARTICIPANTS } from './account-provider-plan';
export const ACCOUNT_ERASURE_WRITER = 'wapps-account-erasure-writer';
export const ACCOUNT_ERASURE_WRITER_ROLE = 'account-erasure:writer';
export const ACCOUNT_ERASURE_WRITER_SCOPE = 'account-erasure';

export class RequestAccountErasure extends ErasureCoordinator {
  constructor(participants: readonly AccountErasureParticipant[]) {
    super(participants, ACCOUNT_ERASURE_PARTICIPANTS);
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

export type { AccountErasureParticipant } from '@sdk/features/identity/libs/management';
