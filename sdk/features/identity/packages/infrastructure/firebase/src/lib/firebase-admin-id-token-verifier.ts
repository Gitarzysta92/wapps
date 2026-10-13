import * as admin from 'firebase-admin';
import { err, ok, Result } from '@sdk/kernel/standard';
import { firebaseErrorCode, firebaseErrorMessage } from './firebase-errors';

export type VerifiedIdTokenDto = {
  uid: string;
  email?: string;
  authTime?: number;
  claims?: unknown;
};

export interface IIdTokenVerifier {
  verifyIdToken(token: string): Promise<Result<VerifiedIdTokenDto, Error>>;
}

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
      return err(new TokenValidationError(message, code));
    }
  }
}
