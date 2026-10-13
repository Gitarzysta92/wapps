import { Inject, Injectable } from '@nestjs/common';
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
import { err, ok } from '@sdk/kernel/standard';
import { AuthenticatedUser } from '../decorators/auth-user.decorator';
import { CANONICAL_IDENTITIES } from './identity-state.tokens';

@Injectable()
export class AccountManagementAppService {
  constructor(
    private readonly domain: IdentityManagementService,
    private readonly authority: AuthorityValidationService,
    @Inject(CANONICAL_IDENTITIES)
    private readonly identities: CanonicalIdentityStore
  ) {}

  private ctxFrom(user: AuthenticatedUser): IdentityManagementContext {
    const roles = user.userClaims?.roles;
    return {
      identityId: user.userId,
      timestamp: Date.now(),
      subject: Array.isArray(roles) ? { roles } : undefined,
    };
  }

  disableUser(uid: string, user: AuthenticatedUser) {
    return this.domain.disableUser(uid, this.ctxFrom(user));
  }
  enableUser(uid: string, user: AuthenticatedUser) {
    return this.domain.enableUser(uid, this.ctxFrom(user));
  }
  revokeTokens(uid: string, user: AuthenticatedUser) {
    return this.domain.revokeTokens(uid, this.ctxFrom(user));
  }
  deleteUser(uid: string, user: AuthenticatedUser) {
    return this.domain.deleteUser(uid, this.ctxFrom(user));
  }
  updateEmail(uid: string, email: string, user: AuthenticatedUser) {
    return this.domain.updateEmail(uid, email, this.ctxFrom(user));
  }
  updatePassword(uid: string, password: string, user: AuthenticatedUser) {
    return this.domain.updatePassword(uid, password, this.ctxFrom(user));
  }
  unlinkProviders(uid: string, providers: string[], user: AuthenticatedUser) {
    return this.domain.unlinkProviders(uid, providers, this.ctxFrom(user));
  }
  generatePasswordResetLink(
    uid: string,
    email: string,
    user: AuthenticatedUser
  ) {
    return this.domain.generatePasswordResetLink(
      uid,
      email,
      this.ctxFrom(user)
    );
  }
  generateEmailVerificationLink(
    uid: string,
    email: string,
    user: AuthenticatedUser
  ) {
    return this.domain.generateEmailVerificationLink(
      uid,
      email,
      this.ctxFrom(user)
    );
  }

  async getIdentityMapping(uid: string, user: AuthenticatedUser) {
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
