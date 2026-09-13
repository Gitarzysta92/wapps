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

function forbidden(actionName: string): Error {
  return new Error(`Forbidden: ${actionName}`);
}

export class IdentityManagementService {
  constructor(
    private readonly authorityValidationService: AuthorityValidationService,
    private readonly userAdmin: IUserAdminPort
  ) {}

  private async authorize(
    actionName: string,
    targetUid: string,
    ctx: IdentityManagementContext
  ): Promise<Result<true, Error>> {
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

  async disableUser(targetUid: string, ctx: IdentityManagementContext): Promise<Result<boolean, Error>> {
    const a = await this.authorize(IDENTITY_USER_DISABLE_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.userAdmin.updateUser(targetUid, { disabled: true });
  }

  async enableUser(targetUid: string, ctx: IdentityManagementContext): Promise<Result<boolean, Error>> {
    const a = await this.authorize(IDENTITY_USER_ENABLE_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.userAdmin.updateUser(targetUid, { disabled: false });
  }

  async revokeTokens(targetUid: string, ctx: IdentityManagementContext): Promise<Result<boolean, Error>> {
    const a = await this.authorize(IDENTITY_USER_REVOKE_TOKENS_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.userAdmin.revokeRefreshTokens(targetUid);
  }

  async deleteUser(targetUid: string, ctx: IdentityManagementContext): Promise<Result<boolean, Error>> {
    const a = await this.authorize(IDENTITY_USER_DELETE_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.userAdmin.deleteUser(targetUid);
  }

  async updateEmail(
    targetUid: string,
    email: string,
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(IDENTITY_USER_UPDATE_EMAIL_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.userAdmin.updateUser(targetUid, { email });
  }

  async updatePassword(
    targetUid: string,
    password: string,
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(IDENTITY_USER_UPDATE_PASSWORD_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.userAdmin.updateUser(targetUid, { password });
  }

  async unlinkProviders(
    targetUid: string,
    providersToUnlink: string[],
    ctx: IdentityManagementContext
  ): Promise<Result<boolean, Error>> {
    const a = await this.authorize(IDENTITY_USER_UNLINK_PROVIDER_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    const patch: UserUpdateDto = { providersToUnlink };
    return this.userAdmin.updateUser(targetUid, patch);
  }

  async generatePasswordResetLink(
    targetUid: string,
    email: string,
    ctx: IdentityManagementContext
  ): Promise<Result<string, Error>> {
    const a = await this.authorize(IDENTITY_USER_GENERATE_PASSWORD_RESET_LINK_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.userAdmin.generatePasswordResetLink(email);
  }

  async generateEmailVerificationLink(
    targetUid: string,
    email: string,
    ctx: IdentityManagementContext
  ): Promise<Result<string, Error>> {
    const a = await this.authorize(IDENTITY_USER_GENERATE_EMAIL_VERIFICATION_LINK_ACTION, targetUid, ctx);
    if (isErr(a)) return err(a.error);
    return this.userAdmin.generateEmailVerificationLink(email);
  }
}

