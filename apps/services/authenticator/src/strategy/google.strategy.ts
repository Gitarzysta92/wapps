import { IAuthenticationStrategy, PrincipalDto } from '@domains/identity/authentication';
import { IIdentitySystemRepository } from '@foundation/identity-system';
import { ok, Result } from '@foundation/standard';

export class GoogleAuthenticationStrategy implements IAuthenticationStrategy {

  constructor(
    private readonly code: string,
    private readonly redirectUri: string,
    private readonly identityRepository: IIdentitySystemRepository,
  ) { }

  async execute(): Promise<Result<PrincipalDto, Error>> {
    const result = await identificationService.exchangeOAuthCodeForSession(
      normalizedProvider as 'google' | 'github',
      code,
      redirectUri,
      codeVerifier
    );

    if (!result.ok) {
      const status = result.error.message.includes('incomplete') ? 500 : 401;
      return res.status(status).json({ error: result.error.message || 'OAuth authentication failed' });
    }
    return ok(new PrincipalDto());
  }

  static appliesTo(provider: string): boolean { 
    return provider.toLowerCase() === 'google';
  }
}