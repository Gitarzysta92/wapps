import type { Result } from '@sdk/kernel/standard';
import type { AuthSessionDto } from '../models/auth-session.dto';
import type { IAuthenticationStrategy } from './authentication-strategy.port';

export interface VerifiedCredentialPrincipal {
  uid: string;
  email?: string;
  authTime?: number;
  claims?: unknown;
}

export interface CredentialTokenVerifier {
  verifyIdToken(
    token: string
  ): Promise<Result<VerifiedCredentialPrincipal, Error>>;
}

export interface CredentialSessionRevoker {
  revokeRefreshTokens(uid: string): Promise<Result<boolean, Error>>;
}

export interface PasswordSignIn {
  signInWithPassword(
    email: string,
    password: string
  ): Promise<Result<AuthSessionDto, Error>>;
}

export interface AuthenticationStrategyFactory<Arguments extends unknown[]> {
  create(...args: Arguments): IAuthenticationStrategy;
}
