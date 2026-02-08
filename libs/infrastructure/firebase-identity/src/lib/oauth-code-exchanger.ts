import fetch from 'node-fetch';
import { err, ok, Result } from '@foundation/standard';
import { IOAuthCodeExchanger, OAuthProvider, OAuthUserInfoDto } from '@domains/identity/identification';

export type OAuthCodeExchangerConfig = {
  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
};

export class OAuthCodeExchanger implements IOAuthCodeExchanger {
  constructor(private readonly config: OAuthCodeExchangerConfig) {}

  async exchangeCode(
    provider: OAuthProvider,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<Result<OAuthUserInfoDto, Error>> {
    try {
      switch (provider) {
        case 'google':
          return await this.exchangeGoogleCode(code, redirectUri, codeVerifier);
        case 'github':
          return await this.exchangeGitHubCode(code, redirectUri);
        default:
          return err(new Error(`Unknown provider: ${provider}`));
      }
    } catch (e: any) {
      const message = e?.message ? String(e.message) : 'OAuth exchange failed';
      return err(new Error(message));
    }
  }

  private async exchangeGoogleCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<Result<OAuthUserInfoDto, Error>> {
    const { googleClientId, googleClientSecret } = this.config;
    if (!googleClientId || !googleClientSecret) {
      return err(new Error('Google OAuth not configured'));
    }

    const params = new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
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
      const error = await tokenResponse.json().catch(() => undefined);
      console.error('Google token exchange error:', error);
      return err(new Error('Failed to exchange Google authorization code'));
    }

    const tokens = (await tokenResponse.json()) as any;
    const userInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokens.id_token}`);

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

  private async exchangeGitHubCode(code: string, redirectUri: string): Promise<Result<OAuthUserInfoDto, Error>> {
    const { githubClientId, githubClientSecret } = this.config;
    if (!githubClientId || !githubClientSecret) {
      return err(new Error('GitHub OAuth not configured'));
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: githubClientId,
        client_secret: githubClientSecret,
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

