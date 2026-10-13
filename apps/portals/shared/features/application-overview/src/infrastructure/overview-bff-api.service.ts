import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, defer, map, of } from 'rxjs';
import { catalogSlug, parseCatalogApp } from '@domains/catalog/record';
import { IApplicationOverviewProvider } from '../application/overview-providers.port';
import { OverviewDto } from '../application/overview.dto';
import { OVERVIEW_API_URL } from './overview-api-url.port';
import { classificationFields } from '@domains/publication/classification';

@Injectable()
export class OverviewBffApiService implements IApplicationOverviewProvider {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(OVERVIEW_API_URL);

  getOverview(slug: string) {
    return defer(() => {
      catalogSlug(slug);
      return this.http
        .get<unknown>(
          `${this.origin}/api/catalog/apps/${encodeURIComponent(slug)}`
        )
        .pipe(
          map((response) => {
            const app = parseCatalogApp(response);
            if (app.slug !== slug)
              throw new Error('Unexpected catalog application');
            const value: OverviewDto = {
              ...classificationFields(app.classification),
              id: app.id,
              revision: app.revision,
              slug: app.slug,
              name: app.name,
              description: app.description,
              website: app.website,
              logo: app.logoUrl,
              banner: app.bannerUrl,
              isPwa: app.isPwa,
              listingDate: app.createdAt,
              updateDate: app.updatedAt,
              platforms: app.platforms,
              monetizations: app.monetizations,
              categories: app.categories,
              tags: app.tags,
              estimatedUsers: app.estimatedNumberOfUsers,
              reviews: app.reviews,
              includedSuites: null,
            };
            return { ok: true as const, value };
          })
        );
    }).pipe(
      catchError((error: unknown) =>
        of({
          ok: false as const,
          error:
            error instanceof Error || error instanceof HttpErrorResponse
              ? error
              : new Error('Could not load application'),
        })
      )
    );
  }
}
