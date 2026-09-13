import { Injectable } from '@nestjs/common';
import { FirebaseAdminIdTokenVerifier, VerifiedIdTokenDto } from '@sdk/extras/identity-firebase';
import { err, ok, Result } from '@sdk/kernel/standard';
import { MysqlIdentityProvider } from './mysql-identity-provider';

@Injectable()
export class TokenValidationService {
  constructor(
    private readonly verifier: FirebaseAdminIdTokenVerifier,
    private readonly identities: MysqlIdentityProvider,
  ) {}

  async validateRequired(authorization?: string): Promise<Result<VerifiedIdTokenDto, Error>> {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? '');
    if (!match) return err(new Error('Bearer token required'));
    const verified = await this.verifier.verifyIdToken(match[1]);
    if (!verified.ok) return verified;
    const identity = await this.identities.obtainIdentity(verified.value.uid);
    if (!identity.ok) return err(identity.error);
    if (!identity.value?.canBeObtained()) return err(new Error('Identity is unavailable'));
    return verified;
  }

  async validateOptional(authorization?: string): Promise<Result<
    { authenticated: false } | { authenticated: true; principal: VerifiedIdTokenDto }, Error
  >> {
    if (!authorization) return ok({ authenticated: false });
    const result = await this.validateRequired(authorization);
    return result.ok ? ok({ authenticated: true, principal: result.value }) : err(result.error);
  }
}
