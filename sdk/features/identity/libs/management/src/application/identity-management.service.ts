import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { err, isErr, ok, Result } from '@sdk/kernel/standard';
import {
  IDENTITY_USER_DELETE_ACTION,
  IDENTITY_USER_DISABLE_ACTION,
  IDENTITY_USER_ENABLE_ACTION,
  IDENTITY_USER_GENERATE_EMAIL_VERIFICATION_LINK_ACTION,
  IDENTITY_USER_GENERATE_PASSWORD_RESET_LINK_ACTION,
  IDENTITY_USER_REVOKE_TOKENS_ACTION,
  IDENTITY_USER_RESOURCE_TYPE,
  IDENTITY_USER_UNLINK_PROVIDER_ACTION,
  IDENTITY_USER_UPDATE_EMAIL_ACTION,
  IDENTITY_USER_UPDATE_PASSWORD_ACTION,
} from './constants';
import { IdentityManagementContext } from './models/identity-management-context';
import { UserUpdateDto } from './models/user-update.dto';
import { IUserAdminPort } from './ports/user-admin.port';
import {
  CanonicalIdentityStore,
  CanonicalIdentityState,
  isCanonicalIdentityId,
  CanonicalIdentityInputError,
  CanonicalIdentityConflict,
} from '@sdk/features/identity/core';

function forbidden(actionName: string): Error {
  return new Error(`Forbidden: ${actionName}`);
}

export class IdentityManagementService {
  constructor(
    private readonly authorityValidationService: AuthorityValidationService,
    private readonly userAdmin: IUserAdminPort,
    private readonly identities: CanonicalIdentityStore
  ) {}

  private async authorize(
    actionName: string,
    targetUid: string,
    ctx: IdentityManagementContext
  ): Promise<Result<true, Error>> {
    if (!isCanonicalIdentityId(targetUid))
      return err(new CanonicalIdentityInputError('Invalid identity ID'));
    const result = await this.authorityValidationService.validate({
      ...ctx,
      actionName,
      timestamp: Date.now(),
      resource: { type: IDENTITY_USER_RESOURCE_TYPE, id: targetUid },
    });

    if (isErr(result)) return err(result.error);
    if (result.value !== true) return err(forbidden(actionName));
    return ok(true);
  }

  async disableUser(
    targetUid: string,
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(
      IDENTITY_USER_DISABLE_ACTION,
      targetUid,
      ctx
    );
    if (isErr(a)) return err(a.error);
    return this.lifecycle(() => this.identities.setSuspended(targetUid, true));
  }

  async enableUser(
    targetUid: string,
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(IDENTITY_USER_ENABLE_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.lifecycle(() => this.identities.setSuspended(targetUid, false));
  }

  async revokeTokens(
    targetUid: string,
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(
      IDENTITY_USER_REVOKE_TOKENS_ACTION,
      targetUid,
      ctx
    );
    if (isErr(a)) return err(a.error);
    return this.result(async () => {
      await this.existing(targetUid);
      return this.userAdmin.revokeRefreshTokens(targetUid);
    });
  }

  async deleteUser(
    targetUid: string,
    ctx: IdentityManagementContext
  ): Promise<
    Result<
      {
        identityId: string;
        revision: number;
        status: 'accepted';
        cleanup: 'pending' | 'completed' | 'failed';
      },
      Error
    >
  > {
    const a = await this.authorize(IDENTITY_USER_DELETE_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.result(async () => {
      const state = await this.identities.requestDeletion(targetUid);
      return ok({
        identityId: state.identityId,
        revision: state.revision,
        status: 'accepted' as const,
        cleanup: state.cleanup,
      });
    });
  }

  async updateEmail(
    targetUid: string,
    email: string,
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(
      IDENTITY_USER_UPDATE_EMAIL_ACTION,
      targetUid,
      ctx
    );
    if (isErr(a)) return err(a.error);
    return this.result(async () => {
      await this.existing(targetUid);
      return this.userAdmin.updateUser(targetUid, { email });
    });
  }

  async updatePassword(
    targetUid: string,
    password: string,
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(
      IDENTITY_USER_UPDATE_PASSWORD_ACTION,
      targetUid,
      ctx
    );
    if (isErr(a)) return err(a.error);
    return this.result(async () => {
      await this.existing(targetUid);
      return this.userAdmin.updateUser(targetUid, { password });
    });
  }

  async unlinkProviders(
    targetUid: string,
    providersToUnlink: string[],
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(
      IDENTITY_USER_UNLINK_PROVIDER_ACTION,
      targetUid,
      ctx
    );
    if (isErr(a)) return err(a.error);
    return this.result(async () => {
      await this.existing(targetUid);
      const patch: UserUpdateDto = { providersToUnlink };
      return this.userAdmin.updateUser(targetUid, patch);
    });
  }

  async generatePasswordResetLink(
    targetUid: string,
    email: string,
    ctx: IdentityManagementContext
  ): Promise<Result<string, Error>> {
    const a = await this.authorize(
      IDENTITY_USER_GENERATE_PASSWORD_RESET_LINK_ACTION,
      targetUid,
      ctx
    );
    if (isErr(a)) return err(a.error);
    return this.result(async () => {
      await this.existing(targetUid);
      return this.userAdmin.generatePasswordResetLink(targetUid, email);
    });
  }

  async generateEmailVerificationLink(
    targetUid: string,
    email: string,
    ctx: IdentityManagementContext
  ): Promise<Result<string, Error>> {
    const a = await this.authorize(
      IDENTITY_USER_GENERATE_EMAIL_VERIFICATION_LINK_ACTION,
      targetUid,
      ctx
    );
    if (isErr(a)) return err(a.error);
    return this.result(async () => {
      await this.existing(targetUid);
      return this.userAdmin.generateEmailVerificationLink(targetUid, email);
    });
  }

  private async result<T>(
    operation: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    try {
      return await operation();
    } catch (error) {
      return err(
        error instanceof Error
          ? error
          : new Error('Identity operation unavailable')
      );
    }
  }

  private async existing(uid: string): Promise<void> {
    const state = await this.identities.find(uid);
    if (!state || state.isDeleted)
      throw new CanonicalIdentityConflict('Identity is unavailable');
  }

  private async lifecycle(
    change: () => Promise<CanonicalIdentityState>
  ): Promise<Result<boolean, Error>> {
    return this.result(async () => {
      await change();
      return ok(true);
    });
  }
}
