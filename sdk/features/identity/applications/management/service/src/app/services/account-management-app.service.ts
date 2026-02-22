import { Inject, Injectable } from '@nestjs/common';
import { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { IdentityManagementContext, IdentityManagementService } from '@sdk/features/identity/libs/management';
import { FirebaseAdminUserAdminPort } from '@infrastructure/firebase-identity';
import { OpaPolicyEvaluator } from '../infrastructure/opa-policy-evaluator';
import { AuthenticatedUser } from '../decorators/auth-user.decorator';
import { IdentityProvisioner } from '../infrastructure/identity/identity-provisioner';

@Injectable()
export class AccountManagementAppService {
  private readonly authorityValidationService: AuthorityValidationService;
  private readonly domain: IdentityManagementService;

  constructor(
    @Inject('IDENTITY_EVENTS_PUBLISHER')
    private readonly events: {
      publishCreated: (args: any) => void;
      publishUpdated: (args: any) => void;
      publishDeleted: (args: any) => void;
    },
    private readonly identityProvisioner: IdentityProvisioner
  ) {
    this.authorityValidationService = new (class extends AuthorityValidationService {})(
      new OpaPolicyEvaluator()
    );

    this.domain = new IdentityManagementService(
      this.authorityValidationService,
      new FirebaseAdminUserAdminPort()
    );
  }

  private ctxFrom(user: AuthenticatedUser): IdentityManagementContext {
    const roles = Array.isArray(user.userClaims?.roles) ? user.userClaims.roles : undefined;
    return {
      identityId: user.userId,
      timestamp: Date.now(),
      subject: roles ? { roles } : undefined,
    };
  }

  disableUser(targetUid: string, user: AuthenticatedUser) {
    return this.domain.disableUser(targetUid, this.ctxFrom(user)).then(async (r) => {
      if (r.ok && this.identityProvisioner) {
        const ensured = await this.identityProvisioner.ensureForFirebaseUid(targetUid);
        if (ensured.ok) {
          this.events.publishUpdated({
            identityId: ensured.value.identityId,
            subjectId: ensured.value.subjectId,
            actorUserId: user.userId,
            actorRoles: user.userClaims?.roles,
            patch: { disabled: true },
          });
        }
      }
      return r;
    });
  }
  enableUser(targetUid: string, user: AuthenticatedUser) {
    return this.domain.enableUser(targetUid, this.ctxFrom(user)).then(async (r) => {
      if (r.ok && this.identityProvisioner) {
        const ensured = await this.identityProvisioner.ensureForFirebaseUid(targetUid);
        if (ensured.ok) {
          this.events.publishUpdated({
            identityId: ensured.value.identityId,
            subjectId: ensured.value.subjectId,
            actorUserId: user.userId,
            actorRoles: user.userClaims?.roles,
            patch: { disabled: false },
          });
        }
      }
      return r;
    });
  }
  revokeTokens(targetUid: string, user: AuthenticatedUser) {
    return this.domain.revokeTokens(targetUid, this.ctxFrom(user)).then(async (r) => {
      if (r.ok && this.identityProvisioner) {
        const ensured = await this.identityProvisioner.ensureForFirebaseUid(targetUid);
        if (ensured.ok) {
          this.events.publishUpdated({
            identityId: ensured.value.identityId,
            subjectId: ensured.value.subjectId,
            actorUserId: user.userId,
            actorRoles: user.userClaims?.roles,
            patch: { revokeTokens: true },
          });
        }
      }
      return r;
    });
  }
  deleteUser(targetUid: string, user: AuthenticatedUser) {
    return this.domain.deleteUser(targetUid, this.ctxFrom(user)).then(async (r) => {
      if (r.ok && this.identityProvisioner) {
        const ensured = await this.identityProvisioner.ensureForFirebaseUid(targetUid);
        if (ensured.ok) {
          this.events.publishDeleted({
            identityId: ensured.value.identityId,
            subjectId: ensured.value.subjectId,
            actorUserId: user.userId,
            actorRoles: user.userClaims?.roles,
          });
        }
        await this.identityProvisioner.deleteByFirebaseUid(targetUid);
      }
      return r;
    });
  }
  updateEmail(targetUid: string, email: string, user: AuthenticatedUser) {
    return this.domain.updateEmail(targetUid, email, this.ctxFrom(user)).then(async (r) => {
      if (r.ok && this.identityProvisioner) {
        const ensured = await this.identityProvisioner.ensureForFirebaseUid(targetUid);
        if (ensured.ok) {
          this.events.publishUpdated({
            identityId: ensured.value.identityId,
            subjectId: ensured.value.subjectId,
            actorUserId: user.userId,
            actorRoles: user.userClaims?.roles,
            patch: { email: true },
          });
        }
      }
      return r;
    });
  }
  updatePassword(targetUid: string, password: string, user: AuthenticatedUser) {
    return this.domain.updatePassword(targetUid, password, this.ctxFrom(user)).then(async (r) => {
      if (r.ok && this.identityProvisioner) {
        const ensured = await this.identityProvisioner.ensureForFirebaseUid(targetUid);
        if (ensured.ok) {
          this.events.publishUpdated({
            identityId: ensured.value.identityId,
            subjectId: ensured.value.subjectId,
            actorUserId: user.userId,
            actorRoles: user.userClaims?.roles,
            patch: { password: true },
          });
        }
      }
      return r;
    });
  }
  unlinkProviders(targetUid: string, providersToUnlink: string[], user: AuthenticatedUser) {
    return this.domain.unlinkProviders(targetUid, providersToUnlink, this.ctxFrom(user)).then(async (r) => {
      if (r.ok && this.identityProvisioner) {
        const ensured = await this.identityProvisioner.ensureForFirebaseUid(targetUid);
        if (ensured.ok) {
          this.events.publishUpdated({
            identityId: ensured.value.identityId,
            subjectId: ensured.value.subjectId,
            actorUserId: user.userId,
            actorRoles: user.userClaims?.roles,
            patch: { providersToUnlink },
          });
        }
      }
      return r;
    });
  }
  generatePasswordResetLink(targetUid: string, email: string, user: AuthenticatedUser) {
    return this.domain.generatePasswordResetLink(targetUid, email, this.ctxFrom(user));
  }
  generateEmailVerificationLink(targetUid: string, email: string, user: AuthenticatedUser) {
    return this.domain.generateEmailVerificationLink(targetUid, email, this.ctxFrom(user));
  }

  async getIdentityMapping(targetUid: string, user: AuthenticatedUser) {
    // Authorization: treat as read on user resource (OPA policy to be added)
    const ctx = this.ctxFrom(user);
    const auth = await this.authorityValidationService.validate({
      ...ctx,
      actionName: 'identity.graph.read',
      timestamp: Date.now(),
      resource: { type: 'user', id: targetUid },
    });
    if (!auth.ok) return auth as any;
    if (auth.value !== true) return { ok: false as const, error: new Error('Forbidden: identity.graph.read') };

    if (!this.identityProvisioner) {
      return { ok: false as const, error: new Error('Identity graph not configured (Mongo missing)') };
    }

    const ensured = await this.identityProvisioner.ensureForFirebaseUid(targetUid);
    if (!ensured.ok) return ensured as any;

    return {
      ok: true as const,
      value: {
        identityId: ensured.value.identityId,
        subjectId: ensured.value.subjectId,
        created: ensured.value.created,
      },
    };
  }
}

