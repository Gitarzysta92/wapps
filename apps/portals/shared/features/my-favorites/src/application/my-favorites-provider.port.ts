import type { Observable } from 'rxjs';
import type { Result } from '@sdk/kernel/standard';
import type {
  CustomerFavoritesDto,
  FavoriteChange,
} from '@domains/customer/favorites';

export interface FavoritesSnapshot {
  identityId: string;
  revision: number;
  /** Canonical IDs in API mode; isolated fixture slugs in demo mode. */
  data: CustomerFavoritesDto;
}

export interface FavoritesCommand extends FavoriteChange {
  identityId: string;
}

export interface IMyFavoritesProvider {
  getMyFavorites(): Observable<Result<FavoritesSnapshot, Error>>;
  change(command: FavoritesCommand): Observable<Result<boolean, Error>>;
}
