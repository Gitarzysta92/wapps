import { inject, Injectable, Injector } from '@angular/core';
import { defer, of, switchMap, type Observable } from 'rxjs';
import { err } from '@sdk/kernel/standard';
import type { ArticleBrowseQuery } from '@domains/publication/article';
import {
  ARTICLE_SESSION,
  ArticleRequestError,
  type ArticleCatalogPort,
  type ArticleChange,
  type ArticleWorkspacePort,
} from '../application/article-workspace.port';

@Injectable()
export class LazyArticleApiService
  implements ArticleWorkspacePort, ArticleCatalogPort
{
  private readonly injector = inject(Injector);
  private readonly session = inject(ARTICLE_SESSION);
  list() {
    return this.request((api) => api.list());
  }
  read(id: string) {
    return this.request((api) => api.read(id));
  }
  status(id: string, review: boolean) {
    return this.request((api) => api.status(id, review));
  }
  reviews(page: number) {
    return this.request((api) => api.reviews(page));
  }
  browse(query: ArticleBrowseQuery) {
    return this.request((api) => api.browse(query));
  }
  find(slug: string) {
    return this.request((api) => api.find(slug));
  }
  change(command: ArticleChange, key: string) {
    const session = this.session.currentKey();
    return this.request((api) =>
      session && session === this.session.currentKey()
        ? api.change(command, key)
        : of(
            err(
              new ArticleRequestError(
                'The account session changed. Reload before continuing.',
                false,
                401
              )
            )
          )
    );
  }
  private request<T>(
    operation: (api: ArticleWorkspacePort & ArticleCatalogPort) => Observable<T>
  ): Observable<T> {
    return defer(() => import('./article-api.service')).pipe(
      switchMap(({ ArticleApiService }) =>
        operation(this.injector.get(ArticleApiService))
      )
    );
  }
}
