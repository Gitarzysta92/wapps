import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, defer, forkJoin, map, of, switchMap } from 'rxjs';
import { parseDiscussionSelection } from '@domains/discussion/contracts';
import { parseCatalogSelection } from '@domains/catalog/record';
import { parsePublicSuiteSelection } from '@domains/publication/suite';
import { parseArticleSelection } from '@domains/publication/article';
import { classificationFields } from '@domains/publication/classification';
import {
  ACCOUNT_FAVORITES_LIMIT,
  parseFavoriteTarget,
  type CustomerFavoritesDto,
} from '@domains/customer/favorites';
import { err, ok } from '@sdk/kernel/standard';
import {
  FAVORITE_CATALOG_ORIGIN,
  FAVORITE_DISCUSSION_ORIGIN,
  favoriteReferences,
  type FavoriteContent,
  type FavoriteContentPort,
} from '../application/favorite-content.port';

@Injectable({ providedIn: 'root' })
export class FavoriteContentApiService implements FavoriteContentPort {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(FAVORITE_CATALOG_ORIGIN);
  private readonly discussionOrigin = inject(FAVORITE_DISCUSSION_ORIGIN);

  resolve(data: CustomerFavoritesDto) {
    return defer(() => {
      const references = favoriteReferences(data);
      if (references.length > ACCOUNT_FAVORITES_LIMIT)
        throw new Error('Favorite limit exceeded');
      for (const target of references) parseFavoriteTarget(target);
      return forkJoin({
        discussions: this.discussions(data.discussions),
        articles: this.select(
          'catalog/article-selection',
          data.articles,
          parseArticleSelection
        ),
        applications: this.select(
          'catalog/app-selection',
          data.applications,
          parseCatalogSelection
        ),
        suites: this.select(
          'catalog/suite-selection',
          data.suites,
          parsePublicSuiteSelection
        ),
      }).pipe(
        map((groups) => {
          const apps = new Map(groups.applications.map((app) => [app.id, app]));
          const articles = new Map(
            groups.articles.map((article) => [article.id, article])
          );
          const suites = new Map(
            groups.suites.map((suite) => [suite.id, suite])
          );
          const discussions = new Map(
            groups.discussions.map((topic) => [topic.id, topic])
          );
          return ok(
            references.map((target): FavoriteContent => {
              const app =
                target.kind === 'applications'
                  ? apps.get(target.id)
                  : undefined;
              const suite =
                target.kind === 'suites' ? suites.get(target.id) : undefined;
              const article =
                target.kind === 'articles'
                  ? articles.get(target.id)
                  : undefined;
              const discussion =
                target.kind === 'discussions'
                  ? discussions.get(target.id)
                  : undefined;
              return app
                ? {
                    ...target,
                    name: app.name,
                    ...classificationFields(app.classification),
                    slug: app.slug,
                    image: app.logoUrl ?? undefined,
                    status: 'available',
                  }
                : suite
                ? {
                    ...target,
                    name: suite.title,
                    ...classificationFields(suite.classification),
                    slug: suite.id,
                    status: 'available',
                  }
                : article
                ? {
                    ...target,
                    name: article.title,
                    ...classificationFields(article.classification),
                    slug: article.slug,
                    status: 'available',
                  }
                : discussion
                ? {
                    ...target,
                    name: discussion.title,
                    ...classificationFields(discussion.classification),
                    slug: discussion.id,
                    appSlug: discussion.appSlug,
                    status: 'available',
                  }
                : {
                    ...target,
                    name:
                      target.kind === 'applications'
                        ? 'Unavailable application'
                        : target.kind === 'suites'
                        ? 'Unavailable suite'
                        : target.kind === 'articles'
                        ? 'Unavailable article'
                        : 'Unavailable discussion',
                    slug: null,
                    status: 'unavailable',
                  };
            })
          );
        })
      );
    }).pipe(
      catchError(() =>
        of(
          err(
            new Error(
              'Saved item details could not be loaded. Your saved references are unchanged.'
            )
          )
        )
      )
    );
  }

  private discussions(ids: string[]) {
    return this.select(
      'discussion-selection',
      ids,
      parseDiscussionSelection,
      this.discussionOrigin
    ).pipe(
      switchMap((topics) =>
        this.select(
          'catalog/app-selection',
          [...new Set(topics.map((topic) => topic.applicationId))],
          parseCatalogSelection
        ).pipe(
          map((apps) =>
            topics.flatMap((topic) => {
              const app = apps.find((app) => app.id === topic.applicationId);
              return app
                ? [
                    {
                      ...topic,
                      appSlug: app.slug,
                      ...classificationFields(app.classification),
                    },
                  ]
                : [];
            })
          )
        )
      )
    );
  }

  private select<T>(
    path: string,
    ids: string[],
    parse: (response: unknown, requested: string[]) => { items: T[] },
    origin = this.origin
  ) {
    const batches = [];
    for (let offset = 0; offset < ids.length; offset += 50) {
      const selected = ids.slice(offset, offset + 50);
      batches.push(
        this.http
          .get<unknown>(`${origin}/api/${path}`, {
            params: { ids: selected.join(',') },
          })
          .pipe(map((response) => parse(response, selected).items))
      );
    }
    return batches.length
      ? forkJoin(batches).pipe(map((groups) => groups.flat()))
      : of([] as T[]);
  }
}
