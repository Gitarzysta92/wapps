import { isRecord } from './firebase-errors';
import fetch from 'node-fetch';
import { err, ok, Result } from '@sdk/kernel/standard';
import type { OAuthUserInfoDto } from './oauth-user-info.dto';

export type FirebaseGithubCodeExchangerConfig = {
  clientId: string;
  clientSecret: string;
};

export class FirebaseGithubCodeExchanger {
  constructor(private readonly config: FirebaseGithubCodeExchangerConfig) {}

  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<Result<OAuthUserInfoDto, Error>> {
    try {
      const { clientId, clientSecret } = this.config;

      const tokenResponse = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          timeout: 10000,
          size: 65536,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          }),
        }
      );

      if (!tokenResponse.ok) {
        return err(new Error('Failed to exchange GitHub authorization code'));
      }

      const tokens: unknown = await tokenResponse.json();
      if (
        !isRecord(tokens) ||
        tokens['error'] ||
        typeof tokens['access_token'] !== 'string' ||
        !tokens['access_token']
      )
        return err(new Error('GitHub authentication failed'));

      const userResponse = await fetch('https://api.github.com/user', {
        timeout: 10000,
        size: 65536,
        headers: {
          Authorization: `Bearer ${tokens['access_token']}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        return err(new Error('Failed to get GitHub user info'));
      }

      const user: unknown = await userResponse.json();
      if (!isRecord(user))
        return err(new Error('Invalid GitHub user response'));

      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        timeout: 10000,
        size: 65536,
        headers: {
          Authorization: `Bearer ${tokens['access_token']}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!emailsResponse.ok)
        return err(new Error('Could not verify GitHub email'));
      const emailData: unknown = await emailsResponse.json();
      if (
        !Array.isArray(emailData) ||
        emailData.length > 100 ||
        !emailData.every(isRecord)
      )
        return err(new Error('Invalid GitHub emails response'));
      const emails = emailData.filter(
        (entry) =>
          typeof entry['email'] === 'string' &&
          entry['email'] &&
          entry['verified'] === true
      );
      const email = (emails.find((e) => e['primary'] && e['verified']) ??
        emails.find((e) => e['verified']))?.['email'];
      if (typeof email !== 'string' || !email)
        return err(new Error('A verified GitHub email is required'));

      return ok({
        email,
        name:
          typeof user['name'] === 'string'
            ? user['name']
            : typeof user['login'] === 'string'
            ? user['login']
            : undefined,
        picture:
          typeof user['avatar_url'] === 'string'
            ? user['avatar_url']
            : undefined,
        emailVerified: true,
      });
    } catch {
      return err(new Error('GitHub authentication provider unavailable'));
    }
  }
}
