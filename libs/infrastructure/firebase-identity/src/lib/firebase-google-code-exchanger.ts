import fetch from 'node-fetch';
import { err, ok, Result } from '@foundation/standard';


export type FirebaseGoogleCodeExchangerConfig = {
  clientId: string;
  clientSecret: string;
};

export type OAuthUserInfoDto = {
  email: string;
  name: string;
  picture: string;
  emailVerified: boolean;
};

export class FirebaseGoogleCodeExchanger {
  constructor(private readonly config: FirebaseGoogleCodeExchangerConfig) {}

  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<Result<OAuthUserInfoDto, Error>> {
    const { clientId, clientSecret } = this.config;

    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    if (codeVerifier) {
      params.set('code_verifier', codeVerifier);
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenResponse.ok) {
      const errorJson = (await tokenResponse.json().catch(() => undefined)) as any;
      const errorCode = errorJson?.error?.error ?? errorJson?.error;
      const errorDescription =
        errorJson?.error?.message ??
        errorJson?.error_description ??
        errorJson?.error?.description;

      console.error('Google token exchange error:', {
        status: tokenResponse.status,
        errorCode,
        errorDescription,
        raw: errorJson,
      });

      const details = [errorCode, errorDescription].filter(Boolean).join(': ');
      return err(new Error(`Google token exchange failed${details ? ` (${details})` : ''}`));
    }

    const tokens = (await tokenResponse.json()) as any;
    const userInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${tokens.id_token}`
    );

    if (!userInfoResponse.ok) {
      return err(new Error('Failed to get Google user info'));
    }

    const userInfo = (await userInfoResponse.json()) as any;
    return ok({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      emailVerified: userInfo.email_verified === 'true',
    });
  }
}
