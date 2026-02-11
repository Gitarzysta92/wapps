import { Result } from '@foundation/standard';
import { OAuthProvider } from '../models/oauth-provider.type';
import { OAuthUserInfoDto } from '../models/oauth-user-info.dto';


export interface IOAuthCodeExchanger {
  exchangeCode(
    provider: OAuthProvider,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<Result<OAuthUserInfoDto, Error>>;
}

