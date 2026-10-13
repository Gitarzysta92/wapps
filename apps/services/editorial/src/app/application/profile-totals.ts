import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  profileTotalsRequest,
  parseProfileContentTotals,
  type ProfileContentCategory,
  type ProfileContentTotals,
} from '@domains/customer/profiles';
import {
  SuiteInputError,
  SuiteUnavailableError,
} from '@domains/publication/suite';
import type { EditorialActor } from './editorial.ports';
import { PROFILE_READER_ID } from '../suites/profile-suites';

export interface PublicationTotalsSource {
  read(
    owner: string,
    categories: readonly ProfileContentCategory[]
  ): Promise<ProfileContentTotals>;
}
export class ProfilePublicationTotals {
  constructor(
    private readonly source: PublicationTotalsSource,
    private readonly policy: IPolicyEvaluator,
    private readonly tenant: string
  ) {}
  async read(input: unknown, actor: EditorialActor) {
    const actionName = 'editorial.profile.totals.read';
    if (
      actor.identityId !== PROFILE_READER_ID ||
      actor.tenantId !== this.tenant ||
      !actor.roles.includes('editorial:profile-reader')
    )
      throw new PermissionDeniedError(actionName);
    let request;
    try {
      request = profileTotalsRequest(input, ['suites', 'articles']);
    } catch {
      throw new SuiteInputError('Invalid profile totals request');
    }
    const decision = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: this.tenant,
      actionName,
      timestamp: Date.now(),
      subject: { roles: actor.roles },
      resource: {
        type: 'profile-totals',
        id: request.ownerIdentityId,
        tenantId: this.tenant,
      },
    });
    if (!decision.ok)
      throw new SuiteUnavailableError('Totals authorization unavailable');
    if (decision.value !== true) throw new PermissionDeniedError(actionName);
    return parseProfileContentTotals(
      await this.source.read(request.ownerIdentityId, request.categories),
      request.categories
    );
  }
}
