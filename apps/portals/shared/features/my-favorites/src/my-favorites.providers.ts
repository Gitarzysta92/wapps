import { inject, type ApplicationConfig } from '@angular/core';
import { of } from 'rxjs';
import { AUTHENTICATION_SESSION } from '@portals/shared/features/identity';
import { LazyMyFavoritesService } from './infrastructure/lazy-my-favorites.service';
import { LazyFavoriteContentService } from './infrastructure/lazy-favorite-content.service';
import { MyFavoritesService } from './application/my-favorites.service';
import { FavoriteContentService } from './application/favorite-content.service';
import {
  FAVORITE_CONTENT,
  FAVORITE_CATALOG_ORIGIN,
  FAVORITE_DISCUSSION_ORIGIN,
} from './application/favorite-content.port';
import {
  FAVORITES_MODE,
  FAVORITES_SESSION,
  type FavoritesSession,
} from './application/favorites-session.port';
import { MY_FAVORITES_API_BASE_URL_PROVIDER } from './application/infrastructure-providers.port';
import { MY_FAVORITES_STATE_PROVIDER } from './application/my-favorites-state-provider.token';
import { MY_FAVORITES_PROVIDER } from './application/my-favorites-provider.token';

export function provideMyFavoritesFeature(config: {
  mode: 'api' | 'demo';
  apiBaseUrl: string;
  catalogBaseUrl?: string;
  discussionBaseUrl?: string;
}): ApplicationConfig {
  if (
    !['api', 'demo'].includes(config.mode) ||
    typeof config.apiBaseUrl !== 'string'
  )
    throw new Error(
      'Favorites mode and API origin must be explicitly configured'
    );
  for (const origin of [
    config.apiBaseUrl,
    config.catalogBaseUrl ?? config.apiBaseUrl,
    config.discussionBaseUrl ?? config.apiBaseUrl,
  ]) {
    if (!origin) continue;
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid favorites service origin');
  }
  return {
    providers: [
      LazyMyFavoritesService,
      LazyFavoriteContentService,
      MyFavoritesService,
      FavoriteContentService,
      { provide: FAVORITES_MODE, useValue: config.mode },
      {
        provide: FAVORITES_SESSION,
        useFactory: (): FavoritesSession => {
          if (config.mode === 'demo')
            return { key$: of('demo'), currentKey: () => 'demo' };
          const session = inject(AUTHENTICATION_SESSION);
          return { key$: session.token$, currentKey: () => session.getToken() };
        },
      },
      { provide: MY_FAVORITES_STATE_PROVIDER, useExisting: MyFavoritesService },
      { provide: MY_FAVORITES_PROVIDER, useExisting: LazyMyFavoritesService },
      { provide: FAVORITE_CONTENT, useExisting: LazyFavoriteContentService },
      {
        provide: FAVORITE_DISCUSSION_ORIGIN,
        useValue: (config.discussionBaseUrl ?? config.apiBaseUrl).replace(
          /\/$/,
          ''
        ),
      },
      {
        provide: MY_FAVORITES_API_BASE_URL_PROVIDER,
        useValue: config.apiBaseUrl.replace(/\/$/, ''),
      },
      {
        provide: FAVORITE_CATALOG_ORIGIN,
        useValue: (config.catalogBaseUrl ?? config.apiBaseUrl).replace(
          /\/$/,
          ''
        ),
      },
    ],
  };
}
