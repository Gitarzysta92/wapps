import { Result } from '@foundation/standard';


export interface IOAuthCodeExchanger {
  exchangeCode(
    provider: OAuthProvider,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<Result<OAuthUserInfoDto, Error>>;
}

