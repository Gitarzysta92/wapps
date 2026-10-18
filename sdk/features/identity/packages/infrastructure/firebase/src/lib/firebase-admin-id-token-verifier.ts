import * as admin from 'firebase-admin';
import { err, ok, Result } from '@sdk/kernel/standard';
import { firebaseErrorCode, firebaseErrorMessage } from './firebase-errors';

import {
  IdentityAuthenticationUnavailable,
  type CredentialTokenVerifier,
  type VerifiedCredentialPrincipal,
} from '@sdk/features/identity/libs/authentication';

export type VerifiedIdTokenDto = VerifiedCredentialPrincipal;
export type IIdTokenVerifier = CredentialTokenVerifier;

export class TokenValidationError extends Error {
  override name = 'TokenValidationError';
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

export class FirebaseAdminIdTokenVerifier implements IIdTokenVerifier {
  constructor(
    private readonly auth: () => admin.auth.Auth = () => admin.auth()
  ) {}
  async verifyIdToken(
    token: string
  ): Promise<Result<VerifiedIdTokenDto, Error>> {
    try {
      const decodedToken = await this.auth().verifyIdToken(token, true);
      const roles: unknown = decodedToken['roles'];
      const tenantId: unknown = decodedToken['tenantId'];
      if (
        roles !== undefined &&
        (!Array.isArray(roles) ||
          roles.length > 64 ||
          roles.some(
            (role) => typeof role !== 'string' || !role || role.length > 128
          ))
      )
        return err(new TokenValidationError('Invalid identity roles'));
      if (
        tenantId !== undefined &&
        (typeof tenantId !== 'string' ||
          !tenantId ||
          tenantId.length > 128 ||
          tenantId.trim() !== tenantId)
      )
        return err(new TokenValidationError('Invalid identity tenant'));

      return ok({
        uid: decodedToken.uid,
        email: decodedToken.email,
        authTime: decodedToken.auth_time,
        claims: {
          ...(roles === undefined ? {} : { roles }),
          ...(tenantId === undefined ? {} : { tenantId }),
        },
      });
    } catch (e) {
      const message = firebaseErrorMessage(e, 'Token validation failed');
      const code = firebaseErrorCode(e);
      return err(
        code &&
          [
            'auth/id-token-expired',
            'auth/id-token-revoked',
            'auth/invalid-id-token',
            'auth/argument-error',
            'auth/user-disabled',
            'auth/user-not-found',
          ].includes(code)
          ? new TokenValidationError(message, code)
          : new IdentityAuthenticationUnavailable(
              'Credential validation unavailable'
            )
      );
    }
  }
}
