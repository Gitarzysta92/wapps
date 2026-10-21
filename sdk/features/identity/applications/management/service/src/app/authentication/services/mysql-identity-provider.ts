import { ConfigService } from '@nestjs/config';
import { Inject, Injectable } from '@nestjs/common';
import {
  IdentityCreationDto,
  IIdentityProvider,
  IdentityAuthenticationUnavailable,
} from '@sdk/features/identity/libs/authentication';
import {
  CanonicalIdentityState,
  CanonicalIdentityStore,
  CredentialIdentityBindings,
  Identity,
} from '@sdk/features/identity/core';
import { Result, err, ok } from '@sdk/kernel/standard';

import { CANONICAL_IDENTITIES } from '../../services/identity-state.tokens';
export { CANONICAL_IDENTITIES } from '../../services/identity-state.tokens';

function toDomain(state: CanonicalIdentityState): Identity {
  return Identity.create({
    id: state.subjectId,
    identityId: state.identityId,
    claim: state.identityId,
    kind: state.kind,
    isActive: state.isActive,
    isSuspended: state.isSuspended,
    isDeleted: state.isDeleted,
    providerType: state.provider,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    deletedAt: state.deletedAt,
  });
}

@Injectable()
export class MysqlIdentityProvider implements IIdentityProvider {
  constructor(
    @Inject(CANONICAL_IDENTITIES)
    private readonly identities: CanonicalIdentityStore &
      CredentialIdentityBindings,
    private readonly config: ConfigService
  ) {}

  async createIdentity(
    dto: IdentityCreationDto,
    extras: { activate?: boolean } = { activate: true }
  ): Promise<Result<Identity, Error>> {
    void dto;
    void extras;
    return err(new Error('Explicit verified enrollment is required'));
  }

  async obtainIdentity(claim: string): Promise<Result<Identity | null, Error>> {
    try {
      const result = await this.identities.findCredential({
        issuer: this.config.getOrThrow<string>('AUTH_ISSUER'),
        subject: claim,
      });
      return ok(result ? toDomain(result) : null);
    } catch {
      return err(
        new IdentityAuthenticationUnavailable('Identity lookup unavailable')
      );
    }
  }
}
