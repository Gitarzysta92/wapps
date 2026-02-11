import { IIdentitySystemRepository } from '@foundation/identity-system';
import { IAuthenticationStrategy, PrincipalDto } from '@domains/identity/authentication';
import { ok, Result } from '@foundation/standard';

export class GitHubAuthenticationStrategy implements IAuthenticationStrategy {
  constructor(
    private readonly code: string,
    private readonly redirectUri: string,
    private readonly identityRepository: IIdentitySystemRepository,
  ) { }

  async execute(): Promise<Result<PrincipalDto, Error>> {
    return ok(new PrincipalDto());
  }

  static appliesTo(provider: string): boolean { 
    return provider.toLowerCase() === 'github';
  }
}