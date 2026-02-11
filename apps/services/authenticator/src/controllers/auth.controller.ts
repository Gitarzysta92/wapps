import { Body, Controller, Get, Inject, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IAuthenticationStrategy, IdentityAuthenticationServiceV2 } from '@domains/identity/authentication';
import { APP_CONFIG, IDENTITY_AUTH_SERVICE } from '../tokens';
import { AuthenticatorAppConfig } from '../app-config';
import { GoogleAuthenticationStrategy } from '../strategy/google.strategy';
import { GitHubAuthenticationStrategy } from '../strategy/github.strategy';
import { SignInOAuthDto } from './dto/sign-in-oauth.dto';
import { buildGoogleAuthorizeUrl, buildGithubAuthorizeUrl } from '../oauth/authorize-url';

@Controller()
export class AuthController {
  constructor(
    @Inject(IDENTITY_AUTH_SERVICE) private readonly identificationService: IdentityAuthenticationServiceV2,
    @Inject(APP_CONFIG) private readonly config: AuthenticatorAppConfig
  ) {}

  @Post('/auth/signin')
  async signIn(@Body() body: any, @Res() res: Response) {
    const { email, password } = body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await this.identificationService.signInWithEmailPassword(email, password);
    if (!result.ok) {
      const status = result.error.message.includes('not configured') ? 500 : 401;
      return res.status(status).json({ error: result.error.message });
    }

    console.log(`✅ User signed in: ${(result.value as any)?.uid ?? 'unknown'}`);
    return res.status(200).json(result.value);
  }

  @Post('/auth/signin/anonymous')
  async signInAnonymous(@Res() res: Response) {
    const result = await this.identificationService.signInAnonymously();
    if (!result.ok) {
      if (result.error.message.includes('not enabled')) {
        return res.status(400).json({ error: result.error.message });
      }

      const status = result.error.message.includes('not configured') ? 500 : 401;
      return res.status(status).json({ error: result.error.message });
    }

    console.log(`✅ Anonymous user created: ${(result.value as any)?.uid ?? 'unknown'}`);
    return res.status(200).json(result.value);
  }

  @Get('/auth/oauth/google/authorize')
  authorizeGoogle(
    @Query('redirect_uri') redirectUri: string | undefined,
    @Query('state') state: string | undefined,
    @Query('code_challenge') codeChallenge: string | undefined,
    @Query('code_challenge_method') codeChallengeMethod: string | undefined,
    @Res() res: Response
  ) {
    if (!redirectUri) {
      return res.status(400).json({ error: 'redirect_uri is required' });
    }
    const { oauth } = this.config;
    if (!oauth.enableGoogle) {
      return res.status(400).json({ error: 'Google OAuth not enabled' });
    }
    if (!oauth.googleClientId) {
      return res.status(500).json({ error: 'Google OAuth misconfigured' });
    }
    const authUrl = buildGoogleAuthorizeUrl({
      clientId: oauth.googleClientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
    });
    return res.redirect(authUrl);
  }

  @Get('/auth/oauth/github/authorize')
  authorizeGithub(
    @Query('redirect_uri') redirectUri: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response
  ) {
    if (!redirectUri) {
      return res.status(400).json({ error: 'redirect_uri is required' });
    }
    const { oauth } = this.config;
    if (!oauth.enableGithub) {
      return res.status(400).json({ error: 'GitHub OAuth not enabled' });
    }
    if (!oauth.githubClientId) {
      return res.status(500).json({ error: 'GitHub OAuth misconfigured' });
    }
    const authUrl = buildGithubAuthorizeUrl({
      clientId: oauth.githubClientId,
      redirectUri,
      state,
    });
    return res.redirect(authUrl);
  }

  @Post('/auth/signin/oauth')
  async signInOAuth(@Body() body: SignInOAuthDto, @Res() res: Response) {
    const { provider, code, redirectUri, codeVerifier } = body;

    let strategy: IAuthenticationStrategy;
    if (GoogleAuthenticationStrategy.appliesTo(provider)) {
      strategy = new GoogleAuthenticationStrategy(code, redirectUri, codeVerifier);
    } else {
      strategy = new GitHubAuthenticationStrategy(code, redirectUri, codeVerifier);
    }

    const result = await this.identificationService.authenticate(strategy);

    if (!result.ok && result.error.message.includes('incomplete')) {
      return res.status(500).json({ error: result.error.message || 'OAuth authentication failed' });
    }

    if (!result.ok) {
      return res.status(401).json({ error: result.error.message || 'OAuth authentication failed' });
    }

    console.log(`✅ OAuth sign in successful for: ${(result.value as any)?.uid ?? 'unknown'}`);
    return res.status(200).json(result.value);
  }


  @Post('/auth/refresh')
  async refresh(@Body() body: any, @Res() res: Response) {
    const { refreshToken } = body ?? {};

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = await this.identificationService.refresh(refreshToken);
    if (!result.ok) {
      const status = result.error.message.includes('not configured') ? 500 : 401;
      return res.status(status).json({
        error: status === 401 ? 'Invalid refresh token' : result.error.message,
      });
    }

    return res.status(200).json(result.value);
  }

  @Post('/auth/signout')
  signOut() {
    return { message: 'Signed out successfully' };
  }
}

