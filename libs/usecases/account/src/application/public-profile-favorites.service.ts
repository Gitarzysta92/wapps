import {
  parsePublicFavoritesCursor,
  publicProfileFavoritesPage,
  type PublicProfileFavoritesPage,
} from '@domains/customer/favorites';
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
import type {
  PublicProfileFavoritesStore,
  PublicProfileFavoriteTargets,
} from './ports/public-profile-favorites.port';

export class PublicProfileFavoritesService {
  constructor(
    private readonly policy: ProfileAudiencePolicy,
    private readonly profiles: PublicProfileStore,
    private readonly favorites: PublicProfileFavoritesStore,
    private readonly targets: PublicProfileFavoriteTargets
  ) {}

  async read(
    id: string,
    viewer: string | null,
    after: unknown
  ): Promise<Result<PublicProfileFavoritesPage, Error>> {
    try {
      if (!isPublicProfileId(id))
        throw new CanonicalIdentityInputError('Invalid profile ID');
      if (viewer !== null && !isCanonicalIdentityId(viewer))
        throw new CanonicalIdentityAccessDenied('Invalid profile viewer');
      let cursor;
      try {
        cursor = parsePublicFavoritesCursor(after);
      } catch {
        throw new CanonicalIdentityInputError('Invalid favorites cursor');
      }
      const snapshot = await this.profiles.inspect(id, viewer);
      if (!snapshot || !(await this.allowed('read', snapshot.facts)))
        throw new PublicProfileNotFound();
      if (!(await this.allowed('read-favorites', snapshot.facts))) {
        if (!(await this.profiles.confirm(snapshot, viewer)))
          throw new PublicProfileNotFound();
        return ok({ sharing: 'hidden', items: [], after: null });
      }
      const saved = await this.favorites.profileFavorites(snapshot, viewer);
      const selected = saved.length ? await this.targets.select(saved) : [];
      if (!(await this.profiles.confirm(snapshot, viewer)))
        throw new PublicProfileNotFound();
      return ok(publicProfileFavoritesPage(selected, saved, cursor));
    } catch (error) {
      return err(
        error instanceof PublicProfileNotFound ||
          error instanceof CanonicalIdentityAccessDenied ||
          error instanceof CanonicalIdentityInputError ||
          error instanceof CanonicalIdentityUnavailable
          ? error
          : new CanonicalIdentityUnavailable('Shared favorites unavailable')
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
