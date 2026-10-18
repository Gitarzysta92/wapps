import {
  parsePreferencesUpdate,
  type AccountPreferences,
  type PreferencesUpdateReceipt,
} from '@domains/customer/preferences';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { IdentityManagementContext } from '@sdk/features/identity/libs/management';
import type { AccountPreferencesStore } from './ports/account-preferences.port';

export class AccountPreferencesService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly store: AccountPreferencesStore
  ) {}

  read(
    ctx: IdentityManagementContext
  ): Promise<Result<AccountPreferences, Error>> {
    return this.run('identity.preferences.read', ctx, () =>
      this.store.getPreferences(ctx.identityId)
    );
  }

  update(
    input: unknown,
    key: string,
    ctx: IdentityManagementContext
  ): Promise<Result<PreferencesUpdateReceipt, Error>> {
    return this.run('identity.preferences.update', ctx, () => {
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
        throw new CanonicalIdentityInputError(
          'A valid Idempotency-Key is required'
        );
      let update;
      try {
        update = parsePreferencesUpdate(input);
      } catch (error) {
        throw new CanonicalIdentityInputError(
          error instanceof Error ? error.message : 'Invalid preferences'
        );
      }
      return this.store.updatePreferences(ctx.identityId, update, key);
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
          'Preferences authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied('Preferences access denied');
      return ok(await operation());
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new CanonicalIdentityUnavailable('Preferences unavailable')
      );
    }
  }
}
