import {
  publicFavoriteKey,
  type SavedFavorite,
} from '@domains/customer/favorites';
import {
  activityIsShared,
  activityPosition,
  compareActivity,
  isPublicProfileId,
  mergeProfileActivity,
  parseProfileActivity,
  parseProfileActivityBatch,
  parseProfileActivityPage,
  profileActivityCursor,
  PROFILE_ACTIVITY_PAGE_SIZE,
  type ProfileActivity,
  type ProfileActivityBatch,
  type ProfileActivityPage,
  type ProfileActivityPosition,
  type ProfileActivitySharing,
} from '@domains/customer/profiles';
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
  PublicProfileActivityStore,
  PublicProfileActivitySource,
  ProfileActivityCursors,
} from './ports/public-profile-activity.port';
import type { PublicProfileFavoriteTargets } from './ports/public-profile-favorites.port';

export class PublicProfileActivityService {
  constructor(
    private readonly policy: ProfileAudiencePolicy,
    private readonly profiles: PublicProfileStore,
    private readonly store: PublicProfileActivityStore,
    private readonly sources: readonly PublicProfileActivitySource[],
    private readonly targets: PublicProfileFavoriteTargets,
    private readonly cursors: ProfileActivityCursors
  ) {}

  async read(
    id: string,
    viewer: string | null,
    after: unknown
  ): Promise<Result<ProfileActivityPage, Error>> {
    try {
      if (!isPublicProfileId(id))
        throw new CanonicalIdentityInputError('Invalid profile ID');
      if (viewer !== null && !isCanonicalIdentityId(viewer))
        throw new CanonicalIdentityAccessDenied('Invalid profile viewer');
      let token: string | null;
      try {
        token = profileActivityCursor(after);
      } catch {
        throw new CanonicalIdentityInputError('Invalid activity cursor');
      }
      const snapshot = await this.profiles.inspect(id, viewer);
      if (!snapshot || !(await this.allowed('read', snapshot.facts)))
        throw new PublicProfileNotFound();
      if (!(await this.allowed('read-activity', snapshot.facts))) {
        if (!(await this.profiles.confirm(snapshot, viewer)))
          throw new PublicProfileNotFound();
        return ok({ sharing: 'hidden', items: [], after: null });
      }
      let position: ProfileActivityPosition | null;
      try {
        position = token ? this.cursors.open(token, id) : null;
      } catch {
        throw new CanonicalIdentityInputError(
          'Invalid activity cursor. Reload the first page.'
        );
      }
      const sharing: ProfileActivitySharing = {
        suites: await this.allowed('read-suites', snapshot.facts),
        discussions: await this.allowed('read-discussions', snapshot.facts),
        favorites: await this.allowed('read-favorites', snapshot.facts),
      };
      const owner = await this.store.contentOwner(snapshot, viewer);
      if (!isCanonicalIdentityId(owner))
        throw new CanonicalIdentityUnavailable(
          'Profile activity owner unavailable'
        );
      if (this.sources.length !== 2)
        throw new CanonicalIdentityUnavailable('Incomplete activity providers');
      const batches = await Promise.all([
        ...this.sources.map((source) => source.read(owner, position, sharing)),
        sharing.favorites
          ? this.store
              .activityFavorites(snapshot, viewer)
              .then((saved) => this.favorites(saved, position, sharing))
          : Promise.resolve({ items: [], through: null }),
      ]);
      for (const batch of batches) {
        const checked = parseProfileActivityBatch(batch);
        if (checked.items.some((item) => !activityIsShared(item, sharing)))
          throw new CanonicalIdentityUnavailable(
            'Activity provider ignored sharing preferences'
          );
      }
      const merged = mergeProfileActivity(batches, position);
      if (!(await this.profiles.confirm(snapshot, viewer)))
        throw new PublicProfileNotFound();
      return ok(
        parseProfileActivityPage({
          sharing: 'visible',
          items: merged.items,
          after: merged.through ? this.cursors.seal(merged.through, id) : null,
        })
      );
    } catch (error) {
      return err(
        error instanceof PublicProfileNotFound ||
          error instanceof CanonicalIdentityAccessDenied ||
          error instanceof CanonicalIdentityInputError ||
          error instanceof CanonicalIdentityUnavailable
          ? error
          : new CanonicalIdentityUnavailable('Profile activity unavailable')
      );
    }
  }

  private async favorites(
    saved: SavedFavorite[],
    after: ProfileActivityPosition | null,
    sharing: ProfileActivitySharing
  ): Promise<ProfileActivityBatch> {
    const names = {
      applications: 'application',
      suites: 'suite',
      articles: 'article',
      discussions: 'discussion',
    } as const;
    const position = (item: SavedFavorite) => ({
      at: item.addedAt,
      key: `favorite-${names[item.kind]}:${item.id}`,
    });
    const candidates = saved
      .filter(
        (item) =>
          (item.kind !== 'suites' || sharing.suites) &&
          (item.kind !== 'discussions' || sharing.discussions) &&
          (!after || compareActivity(after, position(item)) < 0)
      )
      .sort((a, b) => compareActivity(position(a), position(b)));
    const scanned = candidates.slice(0, PROFILE_ACTIVITY_PAGE_SIZE);
    const selected = scanned.length
      ? await this.targets.select(scanned.map(({ kind, id }) => ({ kind, id })))
      : [];
    const items: ProfileActivity[] = selected
      .map((target) => {
        const relation = scanned.find(
          (item) => publicFavoriteKey(item) === publicFavoriteKey(target)
        );
        if (!relation)
          throw new CanonicalIdentityUnavailable(
            'Unrequested activity favorite'
          );
        const name = names[target.kind];
        return parseProfileActivity({
          kind: `favorite-${name}`,
          id: target.id,
          at: relation.addedAt,
          title: target.title,
          target: {
            kind: name,
            id: target.id,
            ...(name === 'suite'
              ? {}
              : name === 'discussion'
              ? { applicationSlug: target.applicationSlug }
              : { slug: target.slug }),
          },
        });
      })
      .sort((a, b) =>
        compareActivity(activityPosition(a), activityPosition(b))
      );
    return parseProfileActivityBatch({
      items,
      through:
        candidates.length > PROFILE_ACTIVITY_PAGE_SIZE
          ? position(scanned[scanned.length - 1])
          : null,
    });
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
