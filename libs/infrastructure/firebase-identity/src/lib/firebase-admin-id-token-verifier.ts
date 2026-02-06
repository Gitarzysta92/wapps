import * as admin from 'firebase-admin';
import { err, ok, Result } from '@foundation/standard';
import { IIdTokenVerifier, VerifiedIdTokenDto } from '@domains/identity/identification';

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
        // Preserve existing behavior from firebase-auth-validator: they read `custom_claims`
        claims: (decodedToken as any).custom_claims,
      });
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'Token validation failed';
      const code = e?.code ? String(e.code) : undefined;
      return err(new TokenValidationError(message, code));
    }
  }
}

