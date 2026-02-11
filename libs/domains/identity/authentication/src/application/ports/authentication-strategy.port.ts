import { Result } from '@foundation/standard';
import { AuthSessionDto } from '../models/auth-session.dto';
import { IIdentitySystemRepository } from '@foundation/identity-system';

export type { IIdentitySystemRepository } from '@foundation/identity-system';

/**
 * Minimal contract exposed to authentication strategies.
 * Keeps strategies decoupled from the concrete service implementation.
 */
export interface AuthenticationServiceShape {
  exchangeOAuthCodeForSession(
    provider: 'google' | 'github',
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<Result<AuthSessionDto, Error>>;
}

export interface IAuthenticationStrategy {
  execute(service: AuthenticationServiceShape): Promise<Result<AuthSessionDto, Error>>;
}