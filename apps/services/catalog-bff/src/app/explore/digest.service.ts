import {
  parseCatalogQuery,
  type CatalogReadPort,
} from '@domains/catalog/record';
import {
  exploreObject,
  parseDigest,
  ExploreUnavailableError,
  type DigestArticles,
  type ExplorePage,
  type ExploreSource,
} from '@domains/feed';

export class DigestService {
  constructor(
    private readonly activity: { read(input: unknown): Promise<ExplorePage> },
    private readonly community: ExploreSource,
    private readonly applications: Pick<CatalogReadPort, 'browse'>,
    private readonly articles: DigestArticles
  ) {}
  async read(input: unknown) {
    exploreObject(input, []);
    try {
      const [latest, discussions, applications, articles] = await Promise.all([
        this.activity.read({}),
        this.community.read(null, 'discussion'),
        this.applications.browse(
          parseCatalogQuery({ sort: 'newest', pageSize: '10' })
        ),
        this.articles.read(),
      ]);
      if (
        articles.page !== 1 ||
        applications.page !== 1 ||
        applications.pageSize !== 10
      )
        throw new ExploreUnavailableError('Unexpected Digest page');
      return parseDigest({
        latest: { items: latest.items, more: latest.after !== null },
        discussions: {
          items: discussions.items,
          more: discussions.through !== null,
        },
        articles: {
          items: articles.items,
          more: articles.total > articles.items.length,
        },
        applications: {
          items: applications.items,
          more: applications.total > applications.items.length,
        },
      });
    } catch {
      throw new ExploreUnavailableError(
        'Digest could not be loaded. Please try again.'
      );
    }
  }
}
