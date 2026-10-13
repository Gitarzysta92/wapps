import { classificationFields } from '@domains/publication/classification';
import type { CatalogReadPort } from '@domains/catalog/record';
import type {
  ArticleBrowseQuery,
  ArticlePage,
} from '@domains/publication/article';
import type {
  PublicSuitePage,
  PublicSuiteQuery,
} from '@domains/publication/suite';
import {
  DiscoveryUnavailableError,
  parsePublicDiscovery,
  parsePublicDiscoveryQuery,
  type PublicDiscoveryGroup,
} from '@domains/discovery';

export interface DiscoveryPublications {
  articles(query: ArticleBrowseQuery): Promise<ArticlePage>;
  suites(query: PublicSuiteQuery): Promise<PublicSuitePage>;
}

/** Each source owns current visibility; failure of any selected source fails the response. */
export class PublicDiscoveryService {
  constructor(
    private readonly applications: Pick<CatalogReadPort, 'browse'>,
    private readonly publications: DiscoveryPublications
  ) {}
  async search(input: unknown) {
    const query = parsePublicDiscoveryQuery(input);
    try {
      const groups = await Promise.all(
        query.kinds.map(async (kind): Promise<PublicDiscoveryGroup> => {
          const page = query.pages[kind],
            pageSize = query.pageSize;
          if (kind === 'application') {
            const result = await this.applications.browse({
              ...query,
              page,
            });
            return {
              kind,
              page: result.page,
              pageSize,
              total: result.total,
              totalPages: result.totalPages,
              items: result.items.map((app) => ({
                id: app.id,
                revision: app.revision,
                slug: app.slug,
                title: app.name,
                ...classificationFields(app.classification),
                summary: Array.from(app.description ?? '')
                  .slice(0, 1000)
                  .join(''),
                at: Date.parse(app.createdAt),
                categories: [
                  ...new Set(
                    app.categories.flatMap((category) => [
                      category.id,
                      category.slug,
                    ])
                  ),
                ],
                tags: [
                  ...new Set(app.tags.flatMap((tag) => [tag.id, tag.slug])),
                ],
                tagNames: [...new Set(app.tags.map((tag) => tag.name))],
              })),
            };
          }
          const sourceQuery = {
            q: query.search,
            page,
            pageSize,
            sort: query.sort,
          };
          const result =
            kind === 'article'
              ? await boundedPage(
                  (p) =>
                    this.publications.articles({
                      ...sourceQuery,
                      page: p,
                      category: query.categories[0] ?? '',
                      tag: query.tags[0] ?? '',
                    }),
                  page,
                  pageSize
                )
              : await boundedPage(
                  (p) => this.publications.suites({ ...sourceQuery, page: p }),
                  page,
                  pageSize
                );
          return {
            kind,
            total: result.total,
            page: result.page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
            items: result.items.map((item) => ({
              id: item.id,
              revision: item.revision,
              slug: 'slug' in item ? item.slug : null,
              title: item.title,
              ...classificationFields(item.classification),
              summary: 'excerpt' in item ? item.excerpt : item.description,
              at: item.publishedAt,
              categories: 'category' in item ? [item.category] : [],
              tags: 'tags' in item ? item.tags : [],
              tagNames: 'tags' in item ? item.tags : [],
            })),
          };
        })
      );
      return parsePublicDiscovery({ groups }, query);
    } catch {
      throw new DiscoveryUnavailableError(
        'Discover is temporarily unavailable. Retry the search.'
      );
    }
  }
}

async function boundedPage<
  T extends { page: number; pageSize?: number; total: number }
>(
  read: (page: number) => Promise<T>,
  requested: number,
  pageSize: number
): Promise<T> {
  const first = await read(requested);
  if (first.page !== requested || first.pageSize !== pageSize)
    throw new DiscoveryUnavailableError('Unexpected source pagination');
  const page = Math.min(
    requested,
    Math.max(1, Math.ceil(first.total / pageSize))
  );
  if (page === requested) return first;
  // One bounded correction after a removal or stale bookmark; never scan all pages.
  const current = await read(page);
  if (
    current.page !== page ||
    current.pageSize !== pageSize ||
    current.total !== first.total
  )
    throw new DiscoveryUnavailableError(
      'Source changed while correcting pagination'
    );
  return current;
}
