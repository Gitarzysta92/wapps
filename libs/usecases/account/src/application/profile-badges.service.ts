import {
  badgeRevision,
  isPublicProfileId,
  parseProfileBadgeChange,
  PROFILE_BADGE_KINDS,
  ProfileBadgeConflict,
  type SharedProfileBadges,
} from '@domains/customer/profiles';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { IdentityManagementContext } from '@sdk/features/identity/libs/management';
import type { ProfileBadgesStore } from './ports/profile-badges.port';
import {
  PublicProfileNotFound,
  type ProfileAudiencePolicy,
  type PublicProfileStore,
} from './ports/public-profile.port';

export class ProfileBadgesService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly audience: ProfileAudiencePolicy,
    private readonly profiles: PublicProfileStore,
    private readonly store: ProfileBadgesStore
  ) {}
  capabilities(ctx: IdentityManagementContext) {
    return this.authorized('read', ctx.identityId, ctx, async () => {
      await this.store.assertStaffIdentity(ctx.identityId);
      return { kinds: [...PROFILE_BADGE_KINDS] };
    });
  }
  administer(id: string, after: unknown, ctx: IdentityManagementContext) {
    return this.authorized('read', id, ctx, async () => {
      this.id(id);
      let cursor: number | null;
      try {
        cursor = after === null ? null : badgeRevision(after, 1);
      } catch {
        throw new CanonicalIdentityInputError('Invalid badge history cursor');
      }
      return this.store.administer(ctx.identityId, id, cursor);
    });
  }
  change(
    id: string,
    input: unknown,
    key: string,
    ctx: IdentityManagementContext
  ) {
    return this.authorized('update', id, ctx, async () => {
      this.id(id);
      if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
        throw new CanonicalIdentityInputError(
          'A valid Idempotency-Key is required'
        );
      let command;
      try {
        command = parseProfileBadgeChange(input);
      } catch {
        throw new CanonicalIdentityInputError(
          'A valid badge, revision, action and reason are required'
        );
      }
      return this.store.change(ctx.identityId, id, command, key);
    });
  }
  own(
    ctx: IdentityManagementContext
  ): Promise<Result<SharedProfileBadges, Error>> {
    return this.authorized('own', ctx.identityId, ctx, () =>
      this.store.own(ctx.identityId)
    );
  }
  async shared(
    id: string,
    viewer: string | null
  ): Promise<Result<SharedProfileBadges, Error>> {
    try {
      this.id(id);
      if (viewer !== null && !isCanonicalIdentityId(viewer))
        throw new CanonicalIdentityAccessDenied('Invalid viewer');
      const snapshot = await this.profiles.inspect(id, viewer);
      if (!snapshot) throw new PublicProfileNotFound();
      const canRead = await this.audience.evaluate('read', snapshot.facts);
      if (!canRead.ok)
        throw new CanonicalIdentityUnavailable(
          'Badge authorization unavailable'
        );
      if (canRead.value !== true) throw new PublicProfileNotFound();
      const canShare = await this.audience.evaluate(
        'read-badges',
        snapshot.facts
      );
      if (!canShare.ok)
        throw new CanonicalIdentityUnavailable(
          'Badge authorization unavailable'
        );
      const value: SharedProfileBadges =
        canShare.value === true
          ? await this.store.shared(snapshot, viewer)
          : { sharing: 'hidden', items: [] };
      if (!(await this.profiles.confirm(snapshot, viewer)))
        throw new PublicProfileNotFound();
      return ok(value);
    } catch (error) {
      return err(this.error(error));
    }
  }
  private async authorized<T>(
    operation: 'read' | 'update' | 'own',
    id: string,
    ctx: IdentityManagementContext,
    run: () => Promise<T>
  ): Promise<Result<T, Error>> {
    try {
      if (!isCanonicalIdentityId(ctx.identityId))
        throw new CanonicalIdentityAccessDenied('Authentication required');
      const self = operation === 'own';
      const decision = await this.authority.validate({
        ...ctx,
        timestamp: Date.now(),
        actionName: self
          ? 'identity.profile.read'
          : `identity.profile-badges.${operation}`,
        resource: { type: self ? 'user' : 'profile-badges', id },
      });
      if (!decision.ok)
        throw new CanonicalIdentityUnavailable(
          'Badge authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied('Badge access denied');
      return ok(await run());
    } catch (error) {
      return err(this.error(error));
    }
  }
  private id(value: string) {
    if (!isPublicProfileId(value))
      throw new CanonicalIdentityInputError('Invalid public profile ID');
  }
  private error(error: unknown): Error {
    if (error instanceof ProfileBadgeConflict)
      return new CanonicalIdentityConflict(error.message);
    return error instanceof Error
      ? error
      : new CanonicalIdentityUnavailable('Badges unavailable');
  }
}
