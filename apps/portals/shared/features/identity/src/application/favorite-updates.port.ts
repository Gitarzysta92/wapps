import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type { FavoriteUpdatePage } from '@domains/customer/favorites';

export interface FavoriteUpdatesPort {
  list(cursor: string | null): Observable<Result<FavoriteUpdatePage, Error>>;
  markRead(
    id: string
  ): Observable<Result<{ id: string; readAt: number }, Error>>;
}
export const FAVORITE_UPDATES = new InjectionToken<FavoriteUpdatesPort>(
  'FAVORITE_UPDATES'
);
export const FAVORITE_UPDATES_URL = new InjectionToken<string>(
  'FAVORITE_UPDATES_URL'
);
