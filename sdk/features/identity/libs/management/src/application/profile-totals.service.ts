import {
  isPublicProfileId,
  parseProfileContentTotals,
  parseProfileTotals,
  type ProfileTotals,
  type ProfileContentTotals,
  type ProfileContentCategory,
} from '@domains/customer/profiles';
import {
  publicFavoriteKey,
  type FavoriteTarget,
} from '@domains/customer/favorites';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import type { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';
import {
  PublicProfileNotFound,
  type ProfileAudiencePolicy,
  type PublicProfileStore,
} from './ports/public-profile.port';
import type { PublicProfileContentOwnerStore } from './ports/public-profile-suites.port';
import type {
  PublicProfileFavoritesStore,
  PublicProfileFavoriteTargets,
} from './ports/public-profile-favorites.port';
import type { PrivateProfileStore } from './ports/private-profile.port';
import type { AccountFavoritesStore } from './ports/account-favorites.port';
import type { ProfileTotalsSource } from './ports/profile-totals.port';
import type { IdentityManagementContext } from './models/identity-management-context';

export class ProfileTotalsService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly audience: ProfileAudiencePolicy,
    private readonly profiles: PublicProfileStore &
      PublicProfileContentOwnerStore &
      PublicProfileFavoritesStore,
    private readonly privateProfiles: PrivateProfileStore,
    private readonly favorites: AccountFavoritesStore,
    private readonly targets: PublicProfileFavoriteTargets,
    private readonly editorial: ProfileTotalsSource,
    private readonly discussion: ProfileTotalsSource
  ) {}

  async shared(
    id: string,
    viewer: string | null
  ): Promise<Result<ProfileTotals, Error>> {
    try {
      if (!isPublicProfileId(id))
        throw new CanonicalIdentityInputError('Invalid profile ID');
      if (viewer !== null && !isCanonicalIdentityId(viewer))
        throw new CanonicalIdentityAccessDenied('Invalid viewer');
      const snapshot = await this.profiles.inspect(id, viewer);
      if (!snapshot || !(await this.allowed('read', snapshot.facts)))
        throw new PublicProfileNotFound();
      const sharing = {
        discussions: await this.allowed('read-discussions', snapshot.facts),
        favorites: await this.allowed('read-favorites', snapshot.facts),
        suites: await this.allowed('read-suites', snapshot.facts),
        articles: await this.allowed('read-activity', snapshot.facts),
      };
      const owner = await this.profiles.contentOwner(snapshot, viewer);
      const saved = sharing.favorites
        ? await this.profiles.profileFavorites(snapshot, viewer)
        : [];
      const result = await this.read(owner, sharing, saved);
      if (!(await this.profiles.confirm(snapshot, viewer)))
        throw new PublicProfileNotFound();
      return ok(result);
    } catch (error) {
      return err(this.error(error));
    }
  }

  async own(
    ctx: IdentityManagementContext
  ): Promise<Result<ProfileTotals, Error>> {
    try {
      if (!isCanonicalIdentityId(ctx.identityId))
        throw new CanonicalIdentityAccessDenied('Authentication required');
      const decision = await this.authority.validate({
        ...ctx,
        timestamp: Date.now(),
        actionName: 'identity.profile.read',
        resource: { type: 'user', id: ctx.identityId },
      });
      if (!decision.ok)
        throw new CanonicalIdentityUnavailable(
          'Totals authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied('Profile access denied');
      const before = await this.privateProfiles.getProfile(ctx.identityId);
      const saved = await this.favorites.read(ctx.identityId);
      if (saved.revision !== before.revision)
        throw new CanonicalIdentityUnavailable('Profile changed while loading');
      const result = await this.read(
        ctx.identityId,
        { discussions: true, favorites: true, suites: true, articles: true },
        saved.favorites.map(({ kind, id }) => ({ kind, id }))
      );
      if (
        (await this.privateProfiles.getProfile(ctx.identityId)).revision !==
        before.revision
      )
        throw new CanonicalIdentityUnavailable('Profile changed while loading');
      return ok(result);
    } catch (error) {
      return err(this.error(error));
    }
  }

  private async read(
    owner: string,
    sharing: Record<keyof ProfileTotals, boolean>,
    saved: FavoriteTarget[]
  ): Promise<ProfileTotals> {
    if (!isCanonicalIdentityId(owner))
      throw new CanonicalIdentityUnavailable('Profile owner unavailable');
    const categories: ProfileContentCategory[] = [];
    if (sharing.suites) categories.push('suites');
    if (sharing.articles) categories.push('articles');
    const [publications, discussions, selected] = await Promise.all([
      categories.length
        ? this.editorial
            .read(owner, categories)
            .then((value) => parseProfileContentTotals(value, categories))
        : Promise.resolve<ProfileContentTotals>({}),
      sharing.discussions
        ? this.discussion
            .read(owner, ['discussions'])
            .then((value) => parseProfileContentTotals(value, ['discussions']))
        : Promise.resolve<ProfileContentTotals>({}),
      sharing.favorites && saved.length
        ? this.targets.select(saved)
        : Promise.resolve([]),
    ]);
    const keys = new Set(saved.map(publicFavoriteKey));
    if (
      new Set(selected.map(publicFavoriteKey)).size !== selected.length ||
      selected.some((item) => !keys.has(publicFavoriteKey(item)))
    )
      throw new CanonicalIdentityUnavailable(
        'Invalid favorite totals selection'
      );
    return parseProfileTotals({
      discussions: sharing.discussions ? discussions.discussions : null,
      favorites: sharing.favorites ? selected.length : null,
      suites: sharing.suites ? publications.suites : null,
      articles: sharing.articles ? publications.articles : null,
    });
  }
  private async allowed(
    ...args: Parameters<ProfileAudiencePolicy['evaluate']>
  ) {
    const result = await this.audience.evaluate(...args);
    if (!result.ok)
      throw new CanonicalIdentityUnavailable(
        'Totals authorization unavailable'
      );
    return result.value === true;
  }
  private error(error: unknown): Error {
    return error instanceof PublicProfileNotFound ||
      error instanceof CanonicalIdentityInputError ||
      error instanceof CanonicalIdentityAccessDenied ||
      error instanceof CanonicalIdentityUnavailable
      ? error
      : new CanonicalIdentityUnavailable('Profile totals unavailable');
  }
}
