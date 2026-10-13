import type {
  AccountFavorites,
  FavoriteChange,
  FavoriteChangeReceipt,
  FavoriteTarget,
  FavoriteUpdateVersion,
} from '@domains/customer/favorites';

export interface AccountFavoritesStore {
  read(identityId: string): Promise<AccountFavorites>;
  /** Check current account lifecycle, receipt and revision before an external target read. */
  inspectChange(
    identityId: string,
    input: FavoriteChange,
    key: string
  ): Promise<FavoriteChangeReceipt | null>;
  /** Repeat lifecycle/receipt/revision checks under the canonical account lock and commit atomically. */
  change(
    identityId: string,
    input: FavoriteChange,
    key: string,
    baseline: FavoriteUpdateVersion | null
  ): Promise<FavoriteChangeReceipt>;
}

export interface FavoriteTargetEligibility {
  /** Owning service checks current target visibility. This never authorizes account access. */
  available(target: FavoriteTarget): Promise<boolean>;
}
