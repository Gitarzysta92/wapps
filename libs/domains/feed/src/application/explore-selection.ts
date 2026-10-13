import {
  compareExplore,
  exploreItemPosition,
  type ExploreItem,
} from './explore';
import { permitsContent } from '@domains/publication/classification';

export interface ExploreSelection {
  showMatureContent: boolean;
  order: 'recent' | 'popular' | 'recommended';
  personalize: boolean;
  preferredCategories: readonly string[];
  excludedCategories: readonly string[];
  preferredTags: readonly string[];
  favorites: ReadonlySet<string>;
}

/** Ordering applies to one bounded chronological page, never an implied global ranking. */
export function selectExplorePage(
  items: readonly ExploreItem[],
  options: ExploreSelection
): ExploreItem[] {
  const matches = (values: string[], preferred: readonly string[]) =>
    values.filter((value) => preferred.includes(value)).length;
  const favorite = (item: ExploreItem) =>
    Number(
      options.favorites.has(`${item.kind}:${item.id}`) ||
        ('applicationId' in item.target &&
          options.favorites.has(`application:${item.target.applicationId}`))
    );
  const affinity = (item: ExploreItem) =>
    matches(item.categories, options.preferredCategories) +
    matches(item.tags, options.preferredTags);
  return items
    .filter(
      (item) =>
        permitsContent(item, options.showMatureContent) &&
        !item.categories.some((value) =>
          options.excludedCategories.includes(value)
        )
    )
    .sort((a, b) => {
      if (options.order === 'popular') {
        const score = (b.engagement ?? 0) - (a.engagement ?? 0);
        if (score) return score;
      }
      if (options.order === 'recommended' && options.personalize) {
        const relevance =
          favorite(b) - favorite(a) || affinity(b) - affinity(a);
        if (relevance) return relevance;
      }
      return compareExplore(exploreItemPosition(a), exploreItemPosition(b));
    });
}
