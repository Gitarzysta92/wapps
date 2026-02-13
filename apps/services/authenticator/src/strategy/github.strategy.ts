import {
  AuthenticationServiceShape,
  IAuthenticationStrategy,
  IOAuthCodeExchanger,
  AuthenticationStrategyResult,
} from '@domains/identity/authentication';
import { err, isErr, Result } from '@foundation/standard';

export class GitHubAuthenticationStrategy implements IAuthenticationStrategy {
  constructor(
    private readonly oauthCodeExchanger: IOAuthCodeExchanger,
    private readonly code: string,
    private readonly redirectUri: string,
    private readonly codeVerifier?: string
  ) {}

  async execute(shape: AuthenticationServiceShape): Promise<Result<AuthenticationStrategyResult, Error>> {
    const userInfoResult = await this.oauthCodeExchanger.exchangeCode(
      'github',
      this.code,
      this.redirectUri,
      this.codeVerifier
    );
    if (isErr(userInfoResult)) {
      return err(userInfoResult.error);
    }
    return shape.getOrCreateUserFromOAuthUserInfo(userInfoResult.value);
  }

  static appliesTo(provider: string): boolean {
    return provider.toLowerCase() === 'github';
  }
}

