import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  FAVORITE_KINDS,
  type CustomerFavoritesDto,
  type FavoriteTarget,
} from '@domains/customer/favorites';
import type { Result } from '@sdk/kernel/standard';
import type { ClassifiedContent } from '@domains/publication/classification';

export interface FavoriteContent extends FavoriteTarget, ClassifiedContent {
  name: string;
  slug: string | null;
  appSlug?: string;
  image?: string;
  status: 'available' | 'unavailable' | 'unknown' | 'loading' | 'hidden';
}
export interface FavoriteContentPort {
  resolve(
    data: CustomerFavoritesDto
  ): Observable<Result<FavoriteContent[], Error>>;
}
export const FAVORITE_CONTENT = new InjectionToken<FavoriteContentPort>(
  'FAVORITE_CONTENT'
);
export const FAVORITE_CATALOG_ORIGIN = new InjectionToken<string>(
  'FAVORITE_CATALOG_ORIGIN'
);
export const FAVORITE_DISCUSSION_ORIGIN = new InjectionToken<string>(
  'FAVORITE_DISCUSSION_ORIGIN'
);

export function favoriteReferences(
  data: CustomerFavoritesDto
): FavoriteTarget[] {
  return FAVORITE_KINDS.flatMap((kind) =>
    data[kind].map((id) => ({ kind, id }))
  );
}
export function unresolvedFavorites(
  data: CustomerFavoritesDto,
  status: 'loading' | 'unknown'
): FavoriteContent[] {
  return favoriteReferences(data).map((target) => ({
    ...target,
    name: status === 'loading' ? 'Loading saved item' : 'Details unavailable',
    slug: null,
    status,
  }));
}
