import type { FeedSortPreference } from '@domains/customer/preferences';
import type { CustomerFavoritesDto } from '@domains/customer/favorites';
import type { CatalogEntry } from '@portals/shared/features/listing';

export interface HomeFeedMetadata {
  id: string;
  timestamp: Date | string | number;
  appSlug?: string;
  discussionSlug?: string;
  articleLink?: string;
  suiteLink?: string;
  tags?: { slug: string }[];
  voting?: { upvotes?: number; downvotes?: number };
  viewsCount?: number;
}

const numeric = (value: number | undefined): number => Number.isFinite(value) ? value! : 0;
const date = (item: HomeFeedMetadata): number => {
  const time = new Date(item.timestamp).getTime();
  return Number.isFinite(time) ? time : 0;
};
const netVotes = (item: HomeFeedMetadata): number => numeric(item.voting?.upvotes) - numeric(item.voting?.downvotes);
const linkSlug = (link?: string): string => (link ?? '').split('/').filter(Boolean).pop() ?? '';

/** Explicit favorite matches first, then shared tags. No inferred interests or random ranking. */
export function sortHomeFeed<T extends HomeFeedMetadata>(
  items: readonly T[],
  sort: FeedSortPreference,
  favorites: CustomerFavoritesDto,
  catalog: readonly CatalogEntry[] = [],
): T[] {
  const favoriteTags = new Set(catalog
    .filter(entry => favorites[entry.kind].includes(entry.slug))
    .flatMap(entry => entry.tags.map(tag => tag.slug)));
  const directMatch = (item: T): number => Number(
    (!!item.appSlug && favorites.applications.includes(item.appSlug)) ||
    (!!item.discussionSlug && favorites.discussions.includes(item.discussionSlug)) ||
    (!!item.articleLink && favorites.articles.includes(linkSlug(item.articleLink))) ||
    (!!item.suiteLink && favorites.suites.includes(linkSlug(item.suiteLink))),
  );
  const tagMatches = (item: T): number => new Set((item.tags ?? []).map(tag => tag.slug).filter(slug => favoriteTags.has(slug))).size;
  return [...items].sort((a, b) => {
    if (sort === 'popular') {
      const popularity = netVotes(b) - netVotes(a) || numeric(b.viewsCount) - numeric(a.viewsCount);
      if (popularity) return popularity;
    }
    if (sort === 'recommended') {
      const relevance = directMatch(b) - directMatch(a) || tagMatches(b) - tagMatches(a);
      if (relevance) return relevance;
    }
    return date(b) - date(a) || a.id.localeCompare(b.id);
  });
}
