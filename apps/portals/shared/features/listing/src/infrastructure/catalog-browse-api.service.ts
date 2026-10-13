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
  readonly kinds = ['applications'] as const;

  browse(input: CatalogQuery) {
    return defer(() => {
      if (input.unsupportedFilters?.length)
        throw new Error('These catalog filters are not available yet.');
      if (input.kind && input.kind !== 'applications')
        throw new Error('This catalog content is not available yet.');
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
