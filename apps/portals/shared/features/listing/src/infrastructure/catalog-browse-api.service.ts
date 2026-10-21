import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of } from 'rxjs';
import {
  CatalogApp,
  catalogQueryParameters,
  parseCatalogFacets,
  parseCatalogPage,
  parseCatalogQuery,
} from '@domains/catalog/record';
import {
  CATALOG_API_URL,
  CatalogBrowserPort,
} from '../application/catalog-browser.port';
import { CatalogEntry, CatalogQuery } from '../application/catalog-listing';
import { CatalogDirectoryKind } from '../application/catalog-directory';
import { classificationFields } from '@domains/publication/classification';
import { parseArticleBrowseQuery, parseArticlePage } from '@domains/publication/article';
import { parsePublicSuiteQuery, parsePublicSuitePage } from '@domains/publication/suite';
import { catalogFacets } from '../application/catalog-listing';

export function catalogAppEntry(app: CatalogApp): CatalogEntry {
  return {
    ...classificationFields(app.classification),
    id: app.id,
    revision: app.revision,
    kind: 'applications',
    slug: app.slug,
    name: app.name,
    description: app.description ?? '',
    image: app.logoUrl ?? undefined,
    categories: app.categories,
    tags: app.tags,
    platforms: app.platforms,
    devices: app.devices,
    monetizations: app.monetizations,
    date: new Date(app.createdAt),
    rating: app.reviews?.rating ?? undefined,
  };
}

@Injectable()
export class CatalogBrowseApiService implements CatalogBrowserPort {
  private readonly http = inject(HttpClient);
  private readonly url = inject(CATALOG_API_URL);
  readonly mode = 'api' as const;
  readonly kinds = ['applications', 'articles', 'suites'] as const;

  browse(input: CatalogQuery) {
    return defer(() => {
      if (input.unsupportedFilters?.length)
        throw new Error('These catalog filters are not available yet.');
      if (input.kind === 'articles' || input.kind === 'suites') return this.browsePublication(input);
      const query = parseCatalogQuery({
        search: input.search,
        category: input.category,
        tags: input.tags,
        platform: input.platform,
        device: input.device,
        monetization: input.monetization,
        sort: input.sort,
        page: String(input.page),
        pageSize: String(input.pageSize),
      });
      return this.http
        .get<unknown>(`${this.url}/api/catalog/apps`, {
          params: catalogQueryParameters(query),
        })
        .pipe(
          map((response) => {
            const page = parseCatalogPage(response);
            if (
              page.pageSize !== query.pageSize ||
              page.page !== Math.min(query.page, page.totalPages)
            )
              throw new Error('Unexpected catalog pagination');
            return {
              ok: true as const,
              value: { ...page, items: page.items.map(catalogAppEntry) },
            };
          })
        );
    }).pipe(
      catchError((error: unknown) =>
        of({
          ok: false as const,
          error:
            error instanceof Error || error instanceof HttpErrorResponse
              ? error
              : new Error('Could not load the catalog'),
        })
      )
    );
  }

  private browsePublication(input: CatalogQuery) {
    if (input.platform || input.device || input.monetization)
      throw new Error('Platform, device and pricing filters apply to applications.');
    const common = { q: input.search, page: String(input.page), pageSize: String(input.pageSize), sort: input.sort };
    const source = input.kind === 'articles'
      ? defer(() => {
          if (input.category.includes(',') || input.tags.length > 1)
            throw new Error('Choose one article category and one tag.');
          const query = parseArticleBrowseQuery({ ...common, category: input.category, tag: input.tags[0] ?? '' });
          return this.http.get<unknown>(`${this.url}/api/catalog/articles`, { params: { ...query } }).pipe(map(response => {
            const page = parseArticlePage(response);
            return { ...page, items: page.items.map((article): CatalogEntry => ({
              ...classificationFields(article.classification), id: article.id, revision: article.revision,
              kind: 'articles', slug: article.slug, name: article.title, description: article.excerpt,
              author: article.byline, date: new Date(article.publishedAt),
              categories: [{ slug: article.category, name: article.category }],
              tags: article.tags.map(tag => ({ slug: tag, name: tag })),
              ...(article.cover ? { articleCover: { articleId: article.id, ...article.cover } } : {}),
            })) };
          }));
        })
      : defer(() => {
          if (input.category || input.tags.length) throw new Error('Suites do not have category or tag filters.');
          const query = parsePublicSuiteQuery(common);
          return this.http.get<unknown>(`${this.url}/api/catalog/suites`, { params: { ...query } }).pipe(map(response => {
            const page = parsePublicSuitePage(response);
            return { ...page, items: page.items.map((suite): CatalogEntry => ({
              ...classificationFields(suite.classification), id: suite.id, revision: suite.revision,
              kind: 'suites', slug: suite.id, name: suite.title, description: suite.description,
              date: new Date(suite.publishedAt), applicationCount: suite.applicationIds.length,
              categories: [], tags: [],
            })) };
          }));
        });
    return source.pipe(map(page => {
      if (page.page !== input.page || (page.pageSize ?? 20) !== input.pageSize)
        throw new Error('Unexpected publication pagination');
      return { ok: true as const, value: { ...page, pageSize: input.pageSize,
        totalPages: Math.max(1, Math.ceil(page.total / input.pageSize)),
        facets: {
          categories: catalogFacets(page.items, 'categories'), tags: catalogFacets(page.items, 'tags'),
          platforms: [], devices: [], monetizations: [],
        },
      } };
    }));
  }

  directory(kind: CatalogDirectoryKind) {
    return this.http.get<unknown>(`${this.url}/api/catalog/facets`).pipe(
      map((response) => {
        const facets = parseCatalogFacets(response);
        const categories = new Map(
          facets.categories.map((category) => [category.id, category])
        );
        const values = kind === 'category' ? facets.categories : facets.tags;
        return {
          ok: true as const,
          value: values
            .map((facet) => ({
              slug: facet.slug,
              name: facet.name,
              description: `Browse applications ${
                kind === 'category' ? 'in' : 'tagged with'
              } ${facet.name}.`,
              parentName:
                'parentId' in facet && typeof facet.parentId === 'string'
                  ? categories.get(facet.parentId)?.name
                  : undefined,
              appCount: null,
              featuredApps: null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        };
      }),
      catchError((error: unknown) =>
        of({
          ok: false as const,
          error:
            error instanceof Error || error instanceof HttpErrorResponse
              ? error
              : new Error('Could not load the catalog taxonomy'),
        })
      )
    );
  }
}
