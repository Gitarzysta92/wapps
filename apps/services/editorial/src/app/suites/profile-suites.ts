import type { IPolicyEvaluator } from '@sdk/kernel/ontology/authority';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  suiteObject,
  profileSuitesCursor,
  SuiteInputError,
  SuiteUnavailableError,
} from '@domains/publication/suite';
import type { EditorialActor } from '../application/editorial.ports';
import type { SuiteCatalog } from './suite-catalog';

export const PROFILE_READER_ID = 'wapps-profile-reader';

export class ProfileSuites {
  constructor(
    private readonly catalog: Pick<SuiteCatalog, 'profile'>,
    private readonly policy: IPolicyEvaluator,
    private readonly publicTenant: string
  ) {}
  async read(input: unknown, actor: EditorialActor) {
    const actionName = 'editorial.profile.suites.read';
    if (
      actor.identityId !== PROFILE_READER_ID ||
      actor.tenantId !== this.publicTenant ||
      !actor.roles.includes('editorial:profile-reader')
    )
      throw new PermissionDeniedError(actionName);
    const row = suiteObject(input, ['ownerIdentityId', 'after']);
    const owner = row['ownerIdentityId'];
    if (
      typeof owner !== 'string' ||
      !owner ||
      owner.length > 128 ||
      owner.trim() !== owner ||
      [...owner].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
    )
      throw new SuiteInputError('Invalid profile content owner');
    const after = profileSuitesCursor(row['after']);
    const decision = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: this.publicTenant,
      actionName,
      timestamp: Date.now(),
      subject: { roles: actor.roles },
      resource: {
        type: 'profile-suite-collection',
        id: owner,
        tenantId: this.publicTenant,
      },
    });
    if (!decision.ok)
      throw new SuiteUnavailableError(
        'Profile suite authorization unavailable'
      );
    if (decision.value !== true) throw new PermissionDeniedError(actionName);
    return this.catalog.profile(owner, after);
  }
}
