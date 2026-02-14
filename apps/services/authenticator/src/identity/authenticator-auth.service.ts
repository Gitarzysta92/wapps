import { err, isErr, ok, Result } from '@foundation/standard';
import {
  AuthSessionDto,
  IAuthenticationStrategy,
  IIdTokenVerifier,
  ISessionGateway,
} from '@domains/identity/authentication';

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization || typeof authorization !== 'string') return null;
  const parts = authorization.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1] || null;
}

/**
 * Authenticator-specific auth service that provides:
 * - authenticate: strategy-based sign-in (email, OAuth, anonymous)
 * - refresh: token refresh via Firebase
 * - validateRequired / validateOptional: token validation for validation endpoints
 */
export class AuthenticatorAuthService {
  constructor(
    private readonly sessionGateway: ISessionGateway,
    private readonly tokenVerifier: IIdTokenVerifier
  ) {}

  async authenticate(strategy: IAuthenticationStrategy): Promise<Result<AuthSessionDto, Error>> {
    const strategyResult = await strategy.execute();
    if (isErr(strategyResult)) {
      return err(strategyResult.error);
    }
    const session = strategyResult.value;
    return ok({
      token: session.token,
      refreshToken: session.refreshToken,
      expiresIn: session.expiresIn,
      uid: session.uid,
    });
  }

  async refresh(refreshToken: string): Promise<Result<AuthSessionDto, Error>> {
    return this.sessionGateway.refresh(refreshToken);
  }

  async validateRequired(authorization: string | undefined): Promise<Result<{ uid: string; email?: string; authTime?: number; claims?: unknown }, Error>> {
    const token = extractBearerToken(authorization);
    if (!token) {
      return err(new Error('Missing or invalid Authorization header'));
    }
    return this.tokenVerifier.verifyIdToken(token);
  }

  async validateOptional(
    authorization: string | undefined
  ): Promise<Result<{ authenticated: boolean; principal?: { uid: string; email?: string; authTime?: number } }, Error>> {
    const token = extractBearerToken(authorization);
    if (!token) {
      return ok({ authenticated: false });
    }
    const result = await this.tokenVerifier.verifyIdToken(token);
    if (isErr(result)) {
      return ok({ authenticated: false });
    }
    return ok({
      authenticated: true,
      principal: {
        uid: result.value.uid,
        email: result.value.email,
        authTime: result.value.authTime,
      },
    });
  }
}
