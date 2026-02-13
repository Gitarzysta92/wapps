import fetch from 'node-fetch';
import { err, ok, Result } from '@foundation/standard';
import { OAuthUserInfoDto } from '@domains/identity/authentication';

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

    let email = user.email;
    if (!email && emailsResponse.ok) {
      const emails = (await emailsResponse.json()) as any[];
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }

    if (!email) {
      return err(new Error('Could not get email from GitHub account'));
    }

    return ok({
      email,
      name: user.name || user.login,
      picture: user.avatar_url,
      emailVerified: true,
    });
  }
}
