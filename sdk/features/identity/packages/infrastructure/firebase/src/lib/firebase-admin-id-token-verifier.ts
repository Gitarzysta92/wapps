import * as admin from 'firebase-admin';
import { err, ok, Result } from '@sdk/kernel/standard';
import { IIdTokenVerifier, VerifiedIdTokenDto } from '@sdk/features/identity/libs/authentication';

export class TokenValidationError extends Error {
  override name = 'TokenValidationError';
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

export class FirebaseAdminIdTokenVerifier implements IIdTokenVerifier {
  async verifyIdToken(token: string): Promise<Result<VerifiedIdTokenDto, Error>> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);

      return ok({
        uid: decodedToken.uid,
        email: decodedToken.email,
        authTime: decodedToken.auth_time,
        // Preserve existing behavior from authenticator: they read `custom_claims`
        claims: (decodedToken as any).custom_claims,
      });
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Token validation failed';
      const code = e?.code ? String(e.code) : undefined;
      return err(new TokenValidationError(message, code));
    }
  }
}

