import { Inject, Injectable } from '@nestjs/common';
import {
  CredentialTokenVerifier,
  VerifiedCredentialPrincipal,
} from '@sdk/features/identity/libs/authentication';
import { CREDENTIAL_TOKEN_VERIFIER } from '../tokens';
import { err, ok, Result } from '@sdk/kernel/standard';
import { MysqlIdentityProvider } from './mysql-identity-provider';

@Injectable()
export class TokenValidationService {
  constructor(
    @Inject(CREDENTIAL_TOKEN_VERIFIER)
    private readonly verifier: CredentialTokenVerifier,
    private readonly identities: MysqlIdentityProvider
  ) {}

  async validateRequired(
    authorization?: string
  ): Promise<Result<VerifiedCredentialPrincipal, Error>> {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? '');
    if (!match) return err(new Error('Bearer token required'));
    const verified = await this.verifier.verifyIdToken(match[1]);
    if (!verified.ok) return verified;
    const identity = await this.identities.obtainIdentity(verified.value.uid);
    if (!identity.ok) return err(identity.error);
    if (!identity.value?.canBeObtained())
      return err(new Error('Identity is unavailable'));
    return ok({ ...verified.value, uid: identity.value.identityId });
  }

  async validateOptional(
    authorization?: string
  ): Promise<
    Result<
      | { authenticated: false }
      | { authenticated: true; principal: VerifiedCredentialPrincipal },
      Error
    >
  > {
    if (!authorization) return ok({ authenticated: false });
    const result = await this.validateRequired(authorization);
    return result.ok
      ? ok({ authenticated: true, principal: result.value })
      : err(result.error);
  }
}
