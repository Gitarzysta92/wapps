import {
  parseProfileUpdate,
  type PrivateProfile,
  type ProfileUpdateReceipt,
} from '@domains/customer/profiles';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, ok, type Result } from '@sdk/kernel/standard';
import type { IdentityManagementContext } from './models/identity-management-context';
import type { PrivateProfileStore } from './ports/private-profile.port';

export class PrivateProfileService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly store: PrivateProfileStore
  ) {}

  read(ctx: IdentityManagementContext): Promise<Result<PrivateProfile, Error>> {
    return this.run('identity.profile.read', ctx, () =>
      this.store.getProfile(ctx.identityId)
    );
  }

  update(
    input: unknown,
    key: string,
    ctx: IdentityManagementContext
  ): Promise<Result<ProfileUpdateReceipt, Error>> {
    return this.run('identity.profile.update', ctx, () => {
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
        throw new CanonicalIdentityInputError(
          'A valid Idempotency-Key is required'
        );
      let update;
      try {
        update = parseProfileUpdate(input);
      } catch (error) {
        throw new CanonicalIdentityInputError(
          error instanceof Error ? error.message : 'Invalid profile'
        );
      }
      return this.store.updateProfile(ctx.identityId, update, key);
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
          'Profile authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied('Profile access denied');
      return ok(await operation());
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new CanonicalIdentityUnavailable('Profile unavailable')
      );
    }
  }
}
