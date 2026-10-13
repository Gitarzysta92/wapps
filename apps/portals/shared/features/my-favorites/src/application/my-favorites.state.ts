import type { CustomerFavoritesDto } from '@domains/customer/favorites';
import type { FavoritesSnapshot } from './my-favorites-provider.port';

export interface MyFavoritesState {
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  signedIn: boolean;
  sessionKey: string | null;
  sessionVersion: number;
  context: FavoritesSnapshot | null;
  data: CustomerFavoritesDto;
}

export function emptyFavorites(): CustomerFavoritesDto {
  return { applications: [], suites: [], articles: [], discussions: [] };
}
