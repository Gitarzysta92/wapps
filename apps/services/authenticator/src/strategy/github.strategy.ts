import { AuthSessionDto, AuthenticationServiceShape, IAuthenticationStrategy } from '@domains/identity/authentication';
import { Result } from '@foundation/standard';

export class GitHubAuthenticationStrategy implements IAuthenticationStrategy {
  constructor(
    private readonly code: string,
    private readonly redirectUri: string,
    private readonly codeVerifier?: string
  ) {}

  execute(service: AuthenticationServiceShape): Promise<Result<AuthSessionDto, Error>> {
    return service.exchangeOAuthCodeForSession('github', this.code, this.redirectUri, this.codeVerifier);
  }

  static appliesTo(provider: string): boolean {
    return provider.toLowerCase() === 'github';
  }
}

