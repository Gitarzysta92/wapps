import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import {
  CanonicalIdentityStore,
  CanonicalIdentityInputError,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import {
  IdentityManagementContext,
  IdentityManagementService,
} from '@sdk/features/identity/libs/management';
import { err, ok, type Result } from '@sdk/kernel/standard';
import { AuthenticatedUser } from '../decorators/auth-user.decorator';
import { CANONICAL_IDENTITIES } from './identity-state.tokens';

@Injectable()
export class AccountManagementAppService {
  private readonly logger = new Logger(AccountManagementAppService.name);
  constructor(
    private readonly domain: IdentityManagementService,
    private readonly authority: AuthorityValidationService,
    @Inject(CANONICAL_IDENTITIES)
    private readonly identities: CanonicalIdentityStore
  ) {}

  private ctxFrom(user: AuthenticatedUser): IdentityManagementContext {
    const roles = user.userClaims?.roles;
    const tenantId = user.userClaims?.['tenantId'];
    if (tenantId !== undefined && !isCanonicalIdentityId(tenantId))
      throw new CanonicalIdentityInputError('Invalid authentication tenant');
    return {
      identityId: user.userId,
      ...(tenantId !== undefined ? { tenantId } : {}),
      timestamp: Date.now(),
      subject: Array.isArray(roles) ? { roles } : undefined,
    };
  }

  disableUser(uid: string, user: AuthenticatedUser) {
    return this.administer('identity.user.disable', uid, user, () =>
      this.domain.disableUser(uid, this.ctxFrom(user))
    );
  }
  enableUser(uid: string, user: AuthenticatedUser) {
    return this.administer('identity.user.enable', uid, user, () =>
      this.domain.enableUser(uid, this.ctxFrom(user))
    );
  }
  revokeTokens(uid: string, user: AuthenticatedUser) {
    return this.administer('identity.user.revoke_tokens', uid, user, () =>
      this.domain.revokeTokens(uid, this.ctxFrom(user))
    );
  }

  private async administer<T>(
    action: string,
    uid: string,
    user: AuthenticatedUser,
    operation: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    let outcome = 'unconfirmed';
    try {
      const result = await operation();
      if (result.ok && result.value !== false) outcome = 'confirmed';
      else if (!result.ok && result.error.message.startsWith('Forbidden:'))
        outcome = 'denied';
      return result;
    } finally {
      // Operational evidence only; canonical lifecycle durability remains in the SQL outbox.
      this.logger.log({
        event: 'identity.administration',
        action,
        actorId: user.userId,
        targetId: isCanonicalIdentityId(uid) ? uid : null,
        outcome,
      });
    }
  }
  deleteUser(uid: string, user: AuthenticatedUser) {
    return this.administer('identity.user.delete', uid, user, () =>
      this.domain.deleteUser(uid, this.ctxFrom(user))
    );
  }
  updateEmail(uid: string, email: string, user: AuthenticatedUser) {
    return this.administer('identity.user.update_email', uid, user, () =>
      this.domain.updateEmail(uid, email, this.ctxFrom(user))
    );
  }
  updatePassword(uid: string, password: string, user: AuthenticatedUser) {
    return this.administer('identity.user.update_password', uid, user, () =>
      this.domain.updatePassword(uid, password, this.ctxFrom(user))
    );
  }
  unlinkProviders(uid: string, providers: string[], user: AuthenticatedUser) {
    return this.administer('identity.user.unlink_provider', uid, user, () =>
      this.domain.unlinkProviders(uid, providers, this.ctxFrom(user))
    );
  }
  generatePasswordResetLink(
    uid: string,
    email: string,
    user: AuthenticatedUser
  ) {
    return this.administer(
      'identity.user.generate_password_reset_link',
      uid,
      user,
      () =>
        this.domain.generatePasswordResetLink(uid, email, this.ctxFrom(user))
    );
  }
  generateEmailVerificationLink(
    uid: string,
    email: string,
    user: AuthenticatedUser
  ) {
    return this.administer(
      'identity.user.generate_email_verification_link',
      uid,
      user,
      () =>
        this.domain.generateEmailVerificationLink(
          uid,
          email,
          this.ctxFrom(user)
        )
    );
  }

  private async authorizeRead(uid: string, user: AuthenticatedUser) {
    if (!isCanonicalIdentityId(uid))
      return err(new CanonicalIdentityInputError('Invalid identity ID'));
    const authorization = await this.authority.validate({
      ...this.ctxFrom(user),
      actionName: 'identity.graph.read',
      timestamp: Date.now(),
      resource: { type: 'user', id: uid },
    });
    if (!authorization.ok) return err(authorization.error);
    if (authorization.value !== true)
      return err(new Error('Forbidden: identity.graph.read'));
    return ok(true);
  }

  async getDeletionStatus(uid: string, user: AuthenticatedUser) {
    const authorization = await this.authorizeRead(uid, user);
    if (!authorization.ok) return authorization;
    const state = await this.identities.findDeletion(uid);
    return ok(
      state
        ? {
            identityId: state.identityId,
            revision: state.revision,
            status: 'accepted' as const,
            cleanup: state.cleanup,
          }
        : null
    );
  }

  async getIdentityMapping(uid: string, user: AuthenticatedUser) {
    const authorization = await this.authorizeRead(uid, user);
    if (!authorization.ok) return authorization;
    const state = await this.identities.find(uid);
    return ok(
      state
        ? {
            identityId: state.identityId,
            subjectId: state.subjectId,
            revision: state.revision,
            isActive: state.isActive,
            isSuspended: state.isSuspended,
            isDeleted: state.isDeleted,
          }
        : null
    );
  }
}
