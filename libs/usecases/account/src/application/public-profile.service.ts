import {
  changeProfileFollow,
  isPublicProfileId,
  parseProfileFollowChange,
  type ProfileDirectory,
  type ProfileFollow,
  type ProfileFollowerList,
  type ProfileFollowingList,
  type PublicProfileView,
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
import type { ProfileAvatarImage } from './ports/profile-avatar.port';
import {
  PublicProfileNotFound,
  type ProfileAudiencePolicy,
  type PublicProfileStore,
} from './ports/public-profile.port';

export class PublicProfileService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly policy: ProfileAudiencePolicy,
    private readonly store: PublicProfileStore
  ) {}

  read(
    id: string,
    viewer: string | null
  ): Promise<Result<PublicProfileView, Error>> {
    return this.run(async () => {
      this.id(id);
      this.viewer(viewer);
      const snapshot = await this.store.inspect(id, viewer);
      if (!snapshot) throw new PublicProfileNotFound();
      const visible = await this.allow('read', snapshot.facts);
      if (!visible && !(await this.allow('request-access', snapshot.facts)))
        throw new PublicProfileNotFound();
      const confirmed = await this.store.confirm(snapshot, viewer);
      if (!confirmed) throw new PublicProfileNotFound();
      return {
        access: visible ? 'visible' : 'followers',
        profile: visible ? confirmed.profile : null,
        isOwner: confirmed.facts.viewerId === confirmed.facts.ownerId,
        follow: confirmed.follow,
      };
    });
  }

  avatar(
    id: string,
    avatarId: string,
    viewer: string | null
  ): Promise<Result<ProfileAvatarImage, Error>> {
    return this.run(async () => {
      this.id(id);
      this.id(avatarId);
      this.viewer(viewer);
      const snapshot = await this.store.inspect(id, viewer);
      if (
        !snapshot ||
        snapshot.profile.avatarId !== avatarId ||
        !(await this.allow('read', snapshot.facts))
      )
        throw new PublicProfileNotFound();
      return this.store.avatar(snapshot, viewer, avatarId);
    });
  }

  directory(
    after: string | null,
    viewer: string | null
  ): Promise<Result<ProfileDirectory, Error>> {
    return this.run(async () => {
      if (after !== null) this.id(after);
      this.viewer(viewer);
      const page = await this.store.directory(after, viewer);
      const profiles: ProfileDirectory['profiles'] = [];
      // Bounded batches avoid turning one directory request into unbounded policy traffic.
      for (let offset = 0; offset < page.snapshots.length; offset += 4) {
        const rows = await Promise.all(
          page.snapshots.slice(offset, offset + 4).map(async (snapshot) => {
            if (!(await this.allow('discover', snapshot.facts))) return null;
            return this.store.confirm(snapshot, viewer);
          })
        );
        for (const row of rows)
          if (row) profiles.push({ ...row.profile, contactEmail: null });
      }
      return { profiles, after: page.after };
    });
  }

  followers(
    after: string | null,
    ctx: IdentityManagementContext
  ): Promise<Result<ProfileFollowerList, Error>> {
    return this.run(async () => {
      await this.self('identity.profile-follows.read', ctx);
      if (after !== null) this.id(after);
      return this.store.followers(ctx.identityId, after);
    });
  }

  following(
    after: string | null,
    ctx: IdentityManagementContext
  ): Promise<Result<ProfileFollowingList, Error>> {
    return this.run(async () => {
      await this.self('identity.profile-follows.read', ctx);
      if (after !== null) this.id(after);
      return this.store.following(ctx.identityId, after);
    });
  }

  changeFollow(
    input: unknown,
    key: string,
    ctx: IdentityManagementContext
  ): Promise<Result<ProfileFollow, Error>> {
    return this.run(async () => {
      await this.self('identity.profile-follows.update', ctx);
      let change;
      try {
        if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
          throw new Error('A valid Idempotency-Key is required');
        change = parseProfileFollowChange(input);
      } catch (error) {
        throw new CanonicalIdentityInputError(
          error instanceof Error ? error.message : 'Invalid follow command'
        );
      }
      const prepared = await this.store.prepareFollow(
        ctx.identityId,
        change,
        key
      );
      if (prepared.receipt) return prepared.receipt;
      const snapshot = prepared.snapshot;
      if (
        !(await this.allow(change.action, snapshot.facts, change.requesterId))
      )
        throw new CanonicalIdentityAccessDenied('Follow action denied');
      let next;
      try {
        next = changeProfileFollow(snapshot.follow, change.action);
      } catch {
        throw new CanonicalIdentityConflict(
          'Follow state changed. Reload before continuing.'
        );
      }
      return this.store.changeFollow(
        ctx.identityId,
        change,
        key,
        snapshot,
        next
      );
    });
  }

  private async allow(
    ...args: Parameters<ProfileAudiencePolicy['evaluate']>
  ): Promise<boolean> {
    const result = await this.policy.evaluate(...args);
    if (!result.ok)
      throw new CanonicalIdentityUnavailable(
        'Profile authorization unavailable'
      );
    return result.value === true;
  }

  private async self(actionName: string, ctx: IdentityManagementContext) {
    if (!isCanonicalIdentityId(ctx.identityId))
      throw new CanonicalIdentityAccessDenied('Authentication required');
    const result = await this.authority.validate({
      ...ctx,
      actionName,
      timestamp: Date.now(),
      resource: { type: 'user', id: ctx.identityId },
    });
    if (!result.ok)
      throw new CanonicalIdentityUnavailable(
        'Profile authorization unavailable'
      );
    if (result.value !== true)
      throw new CanonicalIdentityAccessDenied('Profile action denied');
  }

  private id(value: unknown): void {
    if (!isPublicProfileId(value))
      throw new CanonicalIdentityInputError('Invalid public profile ID');
  }

  private viewer(value: string | null): void {
    if (value !== null && !isCanonicalIdentityId(value))
      throw new CanonicalIdentityAccessDenied('Invalid viewer');
  }

  private async run<T>(operation: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return ok(await operation());
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new CanonicalIdentityUnavailable('Profiles unavailable')
      );
    }
  }
}
