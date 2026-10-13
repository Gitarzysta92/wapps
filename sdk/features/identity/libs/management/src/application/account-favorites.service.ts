import type { FavoriteUpdateSource } from './favorite-update-source';
import {
  parseFavoriteChange,
  type AccountFavorites,
  type FavoriteChangeReceipt,
} from '@domains/customer/favorites';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { IdentityManagementContext } from './models/identity-management-context';
import type {
  AccountFavoritesStore,
  FavoriteTargetEligibility,
} from './ports/account-favorites.port';

export class AccountFavoritesService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly store: AccountFavoritesStore,
    private readonly targets: FavoriteTargetEligibility,
    private readonly updates: FavoriteUpdateSource
  ) {}

  read(
    ctx: IdentityManagementContext
  ): Promise<Result<AccountFavorites, Error>> {
    return this.run('identity.favorites.read', ctx, () =>
      this.store.read(ctx.identityId)
    );
  }

  change(
    input: unknown,
    key: string,
    ctx: IdentityManagementContext
  ): Promise<Result<FavoriteChangeReceipt, Error>> {
    return this.run('identity.favorites.update', ctx, async () => {
      if (
        typeof key !== 'string' ||
        key.length < 1 ||
        key.length > 128 ||
        /[^\x21-\x7e]/.test(key)
      )
        throw new CanonicalIdentityInputError(
          'A valid Idempotency-Key is required'
        );
      let change;
      try {
        change = parseFavoriteChange(input);
      } catch {
        throw new CanonicalIdentityInputError('Invalid favorite change');
      }
      const receipt = await this.store.inspectChange(
        ctx.identityId,
        change,
        key
      );
      if (receipt) return receipt;
      // Removing saved relations and replaying completed commands must survive target outages/deletion.
      if (change.saved && !(await this.targets.available(change.target)))
        throw new CanonicalIdentityInputError('Favorite target is unavailable');
      const baseline = change.saved
        ? await this.updates.read(change.target)
        : null;
      if (
        baseline &&
        (!baseline.content ||
          baseline.target.kind !== change.target.kind ||
          baseline.target.id !== change.target.id)
      )
        throw new CanonicalIdentityInputError('Favorite target is unavailable');
      return this.store.change(
        ctx.identityId,
        change,
        key,
        baseline ? { version: baseline.version, at: baseline.at } : null
      );
    });
  }

  private async run<T>(
    actionName: string,
    ctx: IdentityManagementContext,
    operation: () => Promise<T>
  ): Promise<Result<T, Error>> {
    try {
      if (!isCanonicalIdentityId(ctx.identityId))
        throw new CanonicalIdentityAccessDenied('Authentication required');
      const decision = await this.authority.validate({
        ...ctx,
        timestamp: Date.now(),
        actionName,
        resource: { type: 'user', id: ctx.identityId },
      });
      if (!decision.ok)
        throw new CanonicalIdentityUnavailable(
          'Favorites authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied('Favorites access denied');
      return ok(await operation());
    } catch (error) {
      return err(
        error instanceof CanonicalIdentityAccessDenied ||
          error instanceof CanonicalIdentityConflict ||
          error instanceof CanonicalIdentityInputError ||
          error instanceof CanonicalIdentityUnavailable
          ? error
          : new CanonicalIdentityUnavailable('Favorites unavailable')
      );
    }
  }
}
