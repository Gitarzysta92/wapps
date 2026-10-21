import {
  ExploreInputError,
  ExploreUnavailableError,
  exploreCursor,
  mergeExplore,
  type ExploreCursors,
  type ExploreSource,
} from '@domains/feed';
import type { ExploreRatings } from './explore-ratings';

export class ExploreService {
  constructor(
    private readonly publications: ExploreSource,
    private readonly community: ExploreSource,
    private readonly cursors: ExploreCursors,
    private readonly ratings?: ExploreRatings
  ) {}
  async read(input: unknown) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some((key) => key !== 'after')
    )
      throw new ExploreInputError('Invalid Explore query');
    const token = exploreCursor((input as Record<string, unknown>)['after']);
    const after = token ? this.cursors.open(token) : null;
    try {
      const batch = mergeExplore(
        await Promise.all([
          this.publications.read(after),
          this.community.read(after),
        ]),
        after
      );
      if (
        !this.ratings &&
        batch.items.some((item) => item.details?.kind === 'application')
      )
        throw new ExploreUnavailableError('Activity ratings unconfigured');
      return {
        items: this.ratings
          ? await this.ratings.enrich(batch.items)
          : batch.items,
        after: batch.through ? this.cursors.seal(batch.through) : null,
      };
    } catch {
      throw new ExploreUnavailableError(
        'Activity is temporarily unavailable. Try again.'
      );
    }
  }
}
