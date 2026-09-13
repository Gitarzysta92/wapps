import fetch from 'node-fetch';
import { err, ok, Result } from '@sdk/kernel/standard';
import type { OAuthUserInfoDto } from './oauth-user-info.dto';

export type FirebaseGithubCodeExchangerConfig = {
  clientId: string;
  clientSecret: string;
};

export class FirebaseGithubCodeExchanger {
  constructor(private readonly config: FirebaseGithubCodeExchangerConfig) {}

  async exchangeCode(code: string, redirectUri: string): Promise<Result<OAuthUserInfoDto, Error>> {
    const { clientId, clientSecret } = this.config;

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
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
    });

    if (!tokenResponse.ok) {
      return err(new Error('Failed to exchange GitHub authorization code'));
    }

    const tokens = (await tokenResponse.json()) as any;
    if (tokens.error) {
      console.error('GitHub token error:', tokens);
      return err(new Error(tokens.error_description || 'GitHub authentication failed'));
    }

    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      return err(new Error('Failed to get GitHub user info'));
    }

    const user = (await userResponse.json()) as any;

    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!emailsResponse.ok) return err(new Error('Could not verify GitHub email'));
    const emails = (await emailsResponse.json()) as { email: string; primary: boolean; verified: boolean }[];
    const email = (emails.find(e => e.primary && e.verified) ?? emails.find(e => e.verified))?.email;
    if (!email) return err(new Error('A verified GitHub email is required'));

    return ok({
      email,
      name: user.name || user.login,
      picture: user.avatar_url,
      emailVerified: true,
    });
  }
}
