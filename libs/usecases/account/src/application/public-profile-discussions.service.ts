import {
  profileDiscussionsCursor,
  parseProfileDiscussionsPage,
  type ProfileDiscussionsPage,
} from '@domains/community';
import { isPublicProfileId } from '@domains/customer/profiles';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  PublicProfileNotFound,
  type ProfileAudiencePolicy,
  type PublicProfileStore,
} from './ports/public-profile.port';
import type { PublicProfileContentOwnerStore } from './ports/public-profile-suites.port';
import type { PublicProfileDiscussionsPort } from './ports/public-profile-discussions.port';

export class PublicProfileDiscussionsService {
  constructor(
    private readonly policy: ProfileAudiencePolicy,
    private readonly profiles: PublicProfileStore,
    private readonly owners: PublicProfileContentOwnerStore,
    private readonly discussions: PublicProfileDiscussionsPort
  ) {}
  async read(
    id: string,
    viewer: string | null,
    after: unknown
  ): Promise<Result<ProfileDiscussionsPage, Error>> {
    try {
      if (!isPublicProfileId(id))
        throw new CanonicalIdentityInputError('Invalid profile ID');
      if (viewer !== null && !isCanonicalIdentityId(viewer))
        throw new CanonicalIdentityAccessDenied('Invalid profile viewer');
      let cursor: string | null;
      try {
        cursor = profileDiscussionsCursor(after);
      } catch {
        throw new CanonicalIdentityInputError('Invalid discussion cursor');
      }
      const snapshot = await this.profiles.inspect(id, viewer);
      if (!snapshot || !(await this.allowed('read', snapshot.facts)))
        throw new PublicProfileNotFound();
      if (!(await this.allowed('read-discussions', snapshot.facts))) {
        if (!(await this.profiles.confirm(snapshot, viewer)))
          throw new PublicProfileNotFound();
        return ok({ sharing: 'hidden', items: [], after: null });
      }
      const owner = await this.owners.contentOwner(snapshot, viewer);
      if (!isCanonicalIdentityId(owner))
        throw new CanonicalIdentityUnavailable(
          'Profile discussion owner unavailable'
        );
      const page = parseProfileDiscussionsPage(
        await this.discussions.read(owner, cursor)
      );
      if (page.sharing !== 'visible')
        throw new CanonicalIdentityUnavailable(
          'Invalid profile discussion selection'
        );
      if (!(await this.profiles.confirm(snapshot, viewer)))
        throw new PublicProfileNotFound();
      return ok(page);
    } catch (error) {
      return err(
        error instanceof PublicProfileNotFound ||
          error instanceof CanonicalIdentityAccessDenied ||
          error instanceof CanonicalIdentityInputError ||
          error instanceof CanonicalIdentityUnavailable
          ? error
          : new CanonicalIdentityUnavailable('Shared discussions unavailable')
      );
    }
  }
  private async allowed(
    ...args: Parameters<ProfileAudiencePolicy['evaluate']>
  ): Promise<boolean> {
    const decision = await this.policy.evaluate(...args);
    if (!decision.ok)
      throw new CanonicalIdentityUnavailable(
        'Profile authorization unavailable'
      );
    return decision.value === true;
  }
}
