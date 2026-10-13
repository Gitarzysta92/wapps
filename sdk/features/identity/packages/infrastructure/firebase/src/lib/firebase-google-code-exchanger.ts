import { isRecord } from './firebase-errors';
import fetch from 'node-fetch';
import { err, ok, Result } from '@sdk/kernel/standard';

export type FirebaseGoogleCodeExchangerConfig = {
  clientId: string;
  clientSecret: string;
};

import type { OAuthUserInfoDto } from './oauth-user-info.dto';

export class FirebaseGoogleCodeExchanger {
  constructor(private readonly config: FirebaseGoogleCodeExchangerConfig) {}

  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string
  ): Promise<Result<OAuthUserInfoDto, Error>> {
    try {
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
        timeout: 10000,
        size: 65536,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!tokenResponse.ok) {
        return err(new Error('Google token exchange failed'));
      }

      const tokens: unknown = await tokenResponse.json();
      if (
        !isRecord(tokens) ||
        typeof tokens['id_token'] !== 'string' ||
        !tokens['id_token']
      )
        return err(new Error('Invalid Google token response'));
      const userInfoResponse = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
          tokens['id_token']
        )}`,
        { timeout: 10000, size: 65536 }
      );

      if (!userInfoResponse.ok) {
        return err(new Error('Failed to get Google user info'));
      }

      const userInfo: unknown = await userInfoResponse.json();
      if (
        !isRecord(userInfo) ||
        userInfo['aud'] !== clientId ||
        typeof userInfo['email'] !== 'string' ||
        !userInfo['email']
      )
        return err(new Error('Invalid Google identity'));
      return ok({
        email: userInfo['email'],
        name:
          typeof userInfo['name'] === 'string' ? userInfo['name'] : undefined,
        picture:
          typeof userInfo['picture'] === 'string'
            ? userInfo['picture']
            : undefined,
        emailVerified:
          userInfo['email_verified'] === 'true' ||
          userInfo['email_verified'] === true,
      });
    } catch {
      return err(new Error('Google authentication provider unavailable'));
    }
  }
}
