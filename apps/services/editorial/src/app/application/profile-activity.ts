import {
  PermissionDeniedError,
  type IPolicyEvaluator,
} from '@sdk/kernel/ontology/authority';
import {
  activityPosition,
  parseProfileActivityBatch,
  profileActivityRequest,
  PROFILE_ACTIVITY_PAGE_SIZE,
  type ProfileActivity,
  type ProfileActivityPosition,
} from '@domains/customer/profiles';
import {
  SuiteInputError,
  SuiteUnavailableError,
} from '@domains/publication/suite';
import type { EditorialActor } from './editorial.ports';
import { PROFILE_READER_ID } from '../suites/profile-suites';

export interface PublicationActivityCandidate {
  kind: 'application' | 'suite' | 'article' | 'release';
  id: string;
  at: number;
  revision: number;
  slug: string | null;
  applicationSlug: string | null;
  version: string | null;
}
export interface PublicationActivityIndex {
  read(
    owner: string,
    after: ProfileActivityPosition | null,
    suites: boolean
  ): Promise<PublicationActivityCandidate[]>;
}
export interface PublicationActivityReader {
  read(
    candidate: PublicationActivityCandidate
  ): Promise<{ activity: ProfileActivity; revision: number }>;
}

export class ProfilePublicationActivity {
  constructor(
    private readonly index: PublicationActivityIndex,
    private readonly reader: PublicationActivityReader,
    private readonly policy: IPolicyEvaluator,
    private readonly tenant: string
  ) {}

  async read(input: unknown, actor: EditorialActor) {
    const actionName = 'editorial.profile.activity.read';
    if (
      actor.identityId !== PROFILE_READER_ID ||
      actor.tenantId !== this.tenant ||
      !actor.roles.includes('editorial:profile-reader')
    )
      throw new PermissionDeniedError(actionName);
    let request;
    try {
      request = profileActivityRequest(input);
    } catch {
      throw new SuiteInputError('Invalid activity request');
    }
    const decision = await this.policy.evaluate({
      identityId: actor.identityId,
      tenantId: this.tenant,
      actionName,
      timestamp: Date.now(),
      subject: { roles: actor.roles },
      resource: {
        type: 'profile-activity',
        id: request.ownerIdentityId,
        tenantId: this.tenant,
      },
    });
    if (!decision.ok)
      throw new SuiteUnavailableError('Activity authorization unavailable');
    if (decision.value !== true) throw new PermissionDeniedError(actionName);
    const { ownerIdentityId, after, sharing } = request;
    const candidates = await this.index.read(
      ownerIdentityId,
      after,
      sharing.suites
    );
    if (candidates.length > PROFILE_ACTIVITY_PAGE_SIZE + 1)
      throw new SuiteUnavailableError('Activity selection exceeds bounds');
    const scanned = candidates.slice(0, PROFILE_ACTIVITY_PAGE_SIZE),
      items: ProfileActivity[] = [];
    for (let offset = 0; offset < scanned.length; offset += 5) {
      const batch = await Promise.all(
        scanned.slice(offset, offset + 5).map(async (candidate) => {
          const value = await this.reader.read(candidate);
          if (
            value.revision !== candidate.revision ||
            value.activity.id !== candidate.id ||
            value.activity.kind !== candidate.kind ||
            value.activity.at !== candidate.at
          )
            throw new SuiteUnavailableError(
              'Activity publication changed while loading'
            );
          return value.activity;
        })
      );
      items.push(...batch);
    }
    if (
      JSON.stringify(
        await this.index.read(ownerIdentityId, after, sharing.suites)
      ) !== JSON.stringify(candidates)
    )
      throw new SuiteUnavailableError(
        'Activity authority changed while loading'
      );
    return parseProfileActivityBatch({
      items,
      through:
        candidates.length > PROFILE_ACTIVITY_PAGE_SIZE
          ? activityPosition(items[items.length - 1])
          : null,
    });
  }
}
