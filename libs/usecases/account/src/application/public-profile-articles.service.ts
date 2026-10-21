import {
  profileArticlesCursor,
  parseProfileArticlesPage,
  type ProfileArticlesPage,
} from '@domains/publication/article';
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
import type { PublicProfileArticlesPort } from './ports/public-profile-articles.port';
import type { PublicProfileContentOwnerStore } from './ports/public-profile-suites.port';

export class PublicProfileArticlesService {
  constructor(
    private readonly policy: ProfileAudiencePolicy,
    private readonly profiles: PublicProfileStore,
    private readonly owners: PublicProfileContentOwnerStore,
    private readonly articles: PublicProfileArticlesPort
  ) {}
  async read(
    id: string,
    viewer: string | null,
    after: unknown
  ): Promise<Result<ProfileArticlesPage, Error>> {
    try {
      if (!isPublicProfileId(id))
        throw new CanonicalIdentityInputError('Invalid profile ID');
      if (viewer !== null && !isCanonicalIdentityId(viewer))
        throw new CanonicalIdentityAccessDenied('Invalid profile viewer');
      let cursor: string | null;
      try {
        cursor = profileArticlesCursor(after);
      } catch {
        throw new CanonicalIdentityInputError('Invalid article cursor');
      }
      const snapshot = await this.profiles.inspect(id, viewer);
      if (!snapshot || !(await this.allowed('read', snapshot.facts)))
        throw new PublicProfileNotFound();
      if (!(await this.allowed('read-activity', snapshot.facts))) {
        if (!(await this.profiles.confirm(snapshot, viewer)))
          throw new PublicProfileNotFound();
        return ok({ sharing: 'hidden', items: [], after: null });
      }
      const owner = await this.owners.contentOwner(snapshot, viewer);
      if (!isCanonicalIdentityId(owner))
        throw new CanonicalIdentityUnavailable(
          'Profile article owner unavailable'
        );
      const page = parseProfileArticlesPage(
        await this.articles.read(owner, cursor)
      );
      if (
        page.sharing !== 'visible' ||
        page.items.some((item) => cursor !== null && item.id <= cursor)
      )
        throw new CanonicalIdentityUnavailable(
          'Invalid profile article selection'
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
          : new CanonicalIdentityUnavailable('Shared articles unavailable')
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
