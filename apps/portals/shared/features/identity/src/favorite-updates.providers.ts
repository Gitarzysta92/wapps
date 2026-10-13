import type { Provider } from '@angular/core';
import { of } from 'rxjs';
import { err } from '@sdk/kernel/standard';
import {
  FAVORITE_UPDATES,
  FAVORITE_UPDATES_URL,
  type FavoriteUpdatesPort,
} from './application/favorite-updates.port';
import { FavoriteUpdatesService } from './application/favorite-updates.service';
import { FavoriteUpdatesApiService } from './infrastructure/favorite-updates-api.service';

export function provideFavoriteUpdates(
  mode: 'api' | 'demo',
  apiUrl: string
): Provider[] {
  if (apiUrl) {
    const url = new URL(apiUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid notification API origin');
  }
  const unavailable = () =>
    of(err(new Error('Favorite updates are not delivered in demo mode.')));
  const demo: FavoriteUpdatesPort = {
    list: unavailable,
    markRead: unavailable,
  };
  return [
    FavoriteUpdatesService,
    { provide: FAVORITE_UPDATES_URL, useValue: apiUrl.replace(/\/$/, '') },
    mode === 'api'
      ? { provide: FAVORITE_UPDATES, useClass: FavoriteUpdatesApiService }
      : { provide: FAVORITE_UPDATES, useValue: demo },
  ];
}
