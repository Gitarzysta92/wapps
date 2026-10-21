import { inject, type ApplicationConfig } from '@angular/core';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import {
  ARTICLE_CATALOG,
  ARTICLE_WORKSPACE,
  ARTICLE_ORIGIN,
  ARTICLE_SESSION,
  type ArticleSession,
} from './application/article-workspace.port';
import { LazyArticleApiService } from './infrastructure/lazy-article-api.service';

export function provideArticles(config: {
  mode: 'api' | 'demo';
  apiBaseUrl: string;
}): ApplicationConfig {
  if (
    !['api', 'demo'].includes(config.mode) ||
    typeof config.apiBaseUrl !== 'string'
  )
    throw new Error('Explicit article mode and API origin are required');
  if (config.apiBaseUrl) {
    const url = new URL(config.apiBaseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid article API origin');
  }
  if (config.mode === 'demo') return { providers: [] };
  return {
    providers: [
      LazyArticleApiService,
      { provide: ARTICLE_WORKSPACE, useExisting: LazyArticleApiService },
      { provide: ARTICLE_CATALOG, useExisting: LazyArticleApiService },
      {
        provide: ARTICLE_ORIGIN,
        useValue: config.apiBaseUrl.replace(/\/$/, ''),
      },
      {
        provide: ARTICLE_SESSION,
        useFactory: (): ArticleSession => {
          const session = inject(AUTHENTICATION_SESSION);
          return { key$: session.token$, currentKey: () => session.getToken() };
        },
      },
    ],
  };
}
