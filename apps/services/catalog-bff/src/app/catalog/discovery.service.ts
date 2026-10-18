import { classificationFields } from '@domains/publication/classification';
import type { CatalogApp, CatalogReadPort } from '@domains/catalog/record';
import type {
  ArticleBrowseQuery,
  ArticlePage,
} from '@domains/publication/article';
import type {
  PublicSuitePage,
  PublicSuiteQuery,
  PublicSuite,
} from '@domains/publication/suite';
import {
  DiscoveryUnavailableError,
  parsePublicDiscovery,
  parsePublicDiscoveryQuery,
  type PublicDiscoveryGroup,
  type DiscoveryReviews,
} from '@domains/discovery';

export interface DiscoveryPublications {
  articles(query: ArticleBrowseQuery): Promise<ArticlePage>;
  suites(query: PublicSuiteQuery): Promise<PublicSuitePage>;
  suiteSelection(ids: string[]): Promise<{ items: PublicSuite[] }>;
}
export interface DiscoveryReviewReader {
  read(id: string): Promise<DiscoveryReviews>;
}

/** Each source owns current visibility; failure of any selected source fails the response. */
export class PublicDiscoveryService {
  constructor(
    private readonly applications: Pick<CatalogReadPort, 'browse' | 'select'>,
    private readonly publications: DiscoveryPublications,
    private readonly reviews: DiscoveryReviewReader
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
            const reviews = await batches(result.items, 5, (app) =>
              this.reviews.read(app.id)
            );
            const current = new Map(
              (
                await this.selectApplications(result.items.map((app) => app.id))
              ).map((app) => [app.id, app])
            );
            if (
              result.items.some(
                (app) => !samePublication(app, current.get(app.id))
              )
            )
              throw new DiscoveryUnavailableError(
                'Applications changed during search'
              );
            return {
              kind,
              page: result.page,
              pageSize,
              total: result.total,
              totalPages: result.totalPages,
              items: result.items.map((app, index) => ({
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
                displayTags: app.tags.map(({ slug, name }) => ({ slug, name })),
                details: {
                  kind,
                  logoUrl: app.logoUrl,
                  reviews: reviews[index],
                },
              })),
            };
          }
          const sourceQuery = {
            q: query.search,
            page,
            pageSize,
            sort: query.sort,
          };
          if (kind === 'article') {
            const result = await boundedPage(
              (p) =>
                this.publications.articles({
                  ...sourceQuery,
                  page: p,
                  category: query.categories[0] ?? '',
                  tag: query.tags[0] ?? '',
                }),
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
                slug: item.slug,
                title: item.title,
                ...classificationFields(item.classification),
                summary: item.excerpt,
                at: item.publishedAt,
                categories: [item.category],
                tags: item.tags,
                tagNames: item.tags,
                displayTags: item.tags.map((tag) => ({ slug: tag, name: tag })),
                details: {
                  kind,
                  byline: item.byline,
                  cover: item.cover ?? null,
                },
              })),
            };
          }
          const result = await boundedPage(
            (p) => this.publications.suites({ ...sourceQuery, page: p }),
            page,
            pageSize
          );
          const members = new Map(
            (
              await this.selectApplications(
                result.items.flatMap((suite) =>
                  suite.applicationIds.slice(0, 6)
                )
              )
            ).map((app) => [app.id, app])
          );
          const current = new Map(
            (
              await batches(
                result.items.map((suite) => suite.id),
                50,
                undefined,
                (ids) =>
                  this.publications
                    .suiteSelection(ids)
                    .then((value) => value.items)
              )
            )
              .flat()
              .map((suite) => [suite.id, suite])
          );
          if (
            result.items.some(
              (suite) => !samePublication(suite, current.get(suite.id))
            )
          )
            throw new DiscoveryUnavailableError('Suites changed during search');
          return {
            kind,
            total: result.total,
            page: result.page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
            items: result.items.map((suite) => ({
              id: suite.id,
              revision: suite.revision,
              slug: null,
              title: suite.title,
              ...classificationFields(suite.classification),
              summary: suite.description,
              at: suite.publishedAt,
              categories: [],
              tags: [],
              tagNames: [],
              displayTags: [],
              details: {
                kind,
                applicationCount: suite.applicationIds.length,
                applications: suite.applicationIds.slice(0, 6).flatMap((id) => {
                  const app = members.get(id);
                  return app
                    ? [
                        {
                          id: app.id,
                          slug: app.slug,
                          name: app.name,
                          logoUrl: app.logoUrl,
                          ...classificationFields(app.classification),
                        },
                      ]
                    : [];
                }),
              },
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
  private async selectApplications(ids: string[]): Promise<CatalogApp[]> {
    const unique = [...new Set(ids)],
      result: CatalogApp[] = [];
    for (let offset = 0; offset < unique.length; offset += 50)
      result.push(
        ...(await this.applications.select(unique.slice(offset, offset + 50)))
          .items
      );
    return result;
  }
}

function samePublication(
  a: { revision: number; classification?: string },
  b?: { revision: number; classification?: string }
) {
  return (
    !!b && a.revision === b.revision && a.classification === b.classification
  );
}

async function batches<T, R>(
  items: T[],
  size: number,
  read: ((item: T) => Promise<R>) | undefined,
  readBatch?: (items: T[]) => Promise<R>
): Promise<R[]> {
  const result: R[] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    const batch = items.slice(offset, offset + size);
    if (readBatch) result.push(await readBatch(batch));
    else if (read) result.push(...(await Promise.all(batch.map(read))));
  }
  return result;
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
