import { Inject, Injectable } from '@nestjs/common';
import {
  IdentityCreationDto,
  IIdentityProvider,
  IdentityAuthenticationUnavailable,
} from '@sdk/features/identity/libs/authentication';
import {
  CanonicalIdentityState,
  CanonicalIdentityStore,
  Identity,
} from '@sdk/features/identity/core';
import { Result, err, ok } from '@sdk/kernel/standard';

export const CANONICAL_IDENTITIES = Symbol('CANONICAL_IDENTITIES');

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
    private readonly identities: CanonicalIdentityStore
  ) {}

  async createIdentity(
    dto: IdentityCreationDto,
    extras: { activate?: boolean } = { activate: true }
  ): Promise<Result<Identity, Error>> {
    try {
      if (dto.claim !== dto.identityId)
        throw new Error('Identity must match the verified Firebase UID');
      const result = await this.identities.ensure({
        uid: dto.claim,
        provider: dto.provider,
        kind: dto.kind,
        activate: extras.activate ?? true,
      });
      return ok(toDomain(result.state));
    } catch {
      return err(
        new IdentityAuthenticationUnavailable(
          'Identity persistence unavailable'
        )
      );
    }
  }

  async obtainIdentity(claim: string): Promise<Result<Identity | null, Error>> {
    try {
      const result = await this.identities.find(claim);
      return ok(result ? toDomain(result) : null);
    } catch {
      return err(
        new IdentityAuthenticationUnavailable('Identity lookup unavailable')
      );
    }
  }
}
