import type {
  FavoriteTarget,
  PublicProfileFavorite,
} from '@domains/customer/favorites';
import type { PublicProfileSnapshot } from './public-profile.port';

export interface PublicProfileFavoritesStore {
  /** Read saved relations only if the authorized canonical snapshot still matches. */
  profileFavorites(
    snapshot: PublicProfileSnapshot,
    viewer: string | null
  ): Promise<FavoriteTarget[]>;
}
export interface PublicProfileFavoriteTargets {
  /** Resolve only currently public targets; missing/ineligible targets are omitted. */
  select(targets: FavoriteTarget[]): Promise<PublicProfileFavorite[]>;
}
