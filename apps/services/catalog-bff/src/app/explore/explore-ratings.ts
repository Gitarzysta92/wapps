import {
  ExploreUnavailableError,
  parseExploreItem,
  type ActivityReviews,
  type ExploreItem,
} from '@domains/feed';
import type { CatalogReadPort } from '@domains/catalog/record';

export interface ExploreReviewSummaries {
  read(applicationId: string): Promise<ActivityReviews>;
}

export class ExploreRatings {
  constructor(
    private readonly reviews: ExploreReviewSummaries,
    private readonly applications: Pick<CatalogReadPort, 'find'>
  ) {}
  async enrich(items: ExploreItem[]): Promise<ExploreItem[]> {
    const result: ExploreItem[] = [];
    for (let offset = 0; offset < items.length; offset += 5) {
      result.push(
        ...(await Promise.all(
          items.slice(offset, offset + 5).map(async (item) => {
            if (
              item.details?.kind !== 'application' ||
              item.target.kind !== 'application'
            )
              return item;
            const reviews = await this.reviews.read(item.id);
            const current = await this.applications.find(item.target.slug);
            if (
              !current ||
              current.id !== item.id ||
              current.revision !== item.details.revision ||
              current.classification !== item.classification
            )
              throw new ExploreUnavailableError(
                'Application changed while loading ratings'
              );
            return parseExploreItem({
              ...item,
              details: { ...item.details, reviews },
            });
          })
        ))
      );
    }
    return result;
  }
}
