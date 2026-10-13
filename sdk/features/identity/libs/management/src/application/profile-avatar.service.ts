import {
  isProfileAvatarId,
  parseProfileAvatarChange,
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
import type {
  ProfileAvatarNormalizer,
  ProfileAvatarStore,
} from './ports/profile-avatar.port';

export class ProfileAvatarService {
  constructor(
    private readonly authority: AuthorityValidationService,
    private readonly store: ProfileAvatarStore,
    private readonly normalizer: ProfileAvatarNormalizer
  ) {}

  /** Allows transports to authorize and check retries before buffering a binary body. */
  inspect(input: unknown, key: string, ctx: IdentityManagementContext) {
    return this.run('identity.profile.update', ctx, () =>
      this.store.inspect(ctx.identityId, this.input(input, key), key)
    );
  }

  change(
    input: unknown,
    key: string,
    bytes: Uint8Array | null,
    ctx: IdentityManagementContext
  ): Promise<Result<ProfileUpdateReceipt, Error>> {
    return this.run('identity.profile.update', ctx, async () => {
      const change = this.input(input, key);
      const receipt = await this.store.inspect(ctx.identityId, change, key);
      if (receipt) return receipt;
      if ((change.source === null) !== (bytes === null))
        throw new CanonicalIdentityInputError(
          'Photo body does not match the command'
        );
      const image =
        change.source && bytes
          ? await this.normalizer.normalize(bytes, change.source)
          : null;
      return this.store.change(ctx.identityId, change, key, image);
    });
  }

  read(id: string, ctx: IdentityManagementContext) {
    return this.run('identity.profile.read', ctx, () => {
      if (!isProfileAvatarId(id))
        throw new CanonicalIdentityInputError('Invalid photo ID');
      return this.store.read(ctx.identityId, id);
    });
  }

  private input(input: unknown, key: string) {
    try {
      if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key))
        throw new Error('A valid Idempotency-Key is required');
      return parseProfileAvatarChange(input);
    } catch (error) {
      throw new CanonicalIdentityInputError(
        error instanceof Error ? error.message : 'Invalid photo change'
      );
    }
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
          'Photo authorization unavailable'
        );
      if (decision.value !== true)
        throw new CanonicalIdentityAccessDenied('Photo access denied');
      return ok(await operation());
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new CanonicalIdentityUnavailable('Photo unavailable')
      );
    }
  }
}
