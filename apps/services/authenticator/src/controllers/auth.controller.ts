import { Body, Controller, Get, Inject, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IAuthenticationStrategy, IdentityAuthenticationService } from '@domains/identity/authentication';
import { ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY, APP_CONFIG, EMAIL_AUTHENTICATION_STRATEGY_FACTORY, GITHUB_AUTHENTICATION_STRATEGY_FACTORY, GOOGLE_AUTHENTICATION_STRATEGY_FACTORY, IDENTITY_AUTH_SERVICE, OAUTH_CODE_EXCHANGER } from '../tokens';
import { AuthenticatorAppConfig } from '../app-config';
import { GoogleAuthenticationStrategy } from '../strategy/google.strategy';
import { SignInOAuthDto } from './models/sign-in-oauth.dto';
import { buildGoogleAuthorizeUrl, buildGithubAuthorizeUrl } from '../oauth/authorize-url';
import { FirebaseGoogleCodeExchanger } from '@infrastructure/firebase-identity';
import { EmailAuthenticationStrategyFactory } from '../strategy/email-strategy.factory';
import { GoogleAuthenticationStrategyFactory } from '../strategy/google-strategy.factory';
import { GithubAuthenticationStrategyFactory } from '../strategy/github-strategy.factory';
import { GithubAuthenticationStrategy } from '../strategy/github.strategy';
import { AnonymousAuthenticationStrategyFactory } from '../strategy/anonymous-strategy.factory';
import { SignInCredentialsDto } from './models/sign-in-credentials.dto';

@Controller()
export class AuthController {
  constructor(
    @Inject(IDENTITY_AUTH_SERVICE) private readonly authenticationService: IdentityAuthenticationService,
    @Inject(APP_CONFIG) private readonly config: AuthenticatorAppConfig,
    @Inject(OAUTH_CODE_EXCHANGER) private readonly oauthCodeExchanger: FirebaseGoogleCodeExchanger,
    @Inject(GOOGLE_AUTHENTICATION_STRATEGY_FACTORY) private readonly googleAuthenticationStrategyFactory: GoogleAuthenticationStrategyFactory,
    @Inject(GITHUB_AUTHENTICATION_STRATEGY_FACTORY) private readonly githubAuthenticationStrategyFactory: GithubAuthenticationStrategyFactory,
    @Inject(EMAIL_AUTHENTICATION_STRATEGY_FACTORY) private readonly emailAuthenticationStrategyFactory: EmailAuthenticationStrategyFactory,
    @Inject(ANONYMOUS_AUTHENTICATION_STRATEGY_FACTORY) private readonly anonymousAuthenticationStrategyFactory: AnonymousAuthenticationStrategyFactory,
  ) {}

  @Post('/auth/signin')
  async signIn(@Body() body: SignInCredentialsDto, @Res() res: Response) {
    const { email, password } = body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const strategy = this.emailAuthenticationStrategyFactory.create(email, password);
    const result = await this.authenticationService.authenticate(strategy);
    if (!result.ok) {
      return res.status(401).json({ error: result.error.message });
    }

    return res.status(200).json(result.value);
  }

  @Post('/auth/signin/anonymous')
  async signInAnonymous(@Res() res: Response) {
    const strategy = this.anonymousAuthenticationStrategyFactory.create();
    const result = await this.authenticationService.authenticate(strategy);
    if (!result.ok) {
      return res.status(401).json({ error: result.error.message });
    }

    return res.status(200).json(result.value);
  }

  @Post('/auth/signin/oauth')
  async signInOAuth(@Body() body: SignInOAuthDto, @Res() res: Response) {
    const { provider, code, redirectUri, codeVerifier } = body;

    let strategy: IAuthenticationStrategy;
    if (GoogleAuthenticationStrategy.appliesTo(provider)) {
      strategy = this.googleAuthenticationStrategyFactory.create(code, redirectUri, codeVerifier ?? '');
    } else if (GithubAuthenticationStrategy.appliesTo(provider)) {
      strategy = this.githubAuthenticationStrategyFactory.create(code, redirectUri);
    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const result = await this.authenticationService.authenticate(strategy);

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

    const result = await this.authenticationService.refresh(refreshToken);
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
}

