import { Request, Response, Router } from 'express';
import { GoogleAuthenticationStrategy } from './strategy/google.strategy';
import { IAuthenticationStrategy } from '../../../../libs/domains/identity/authentication/src';
import { GitHubAuthenticationStrategy } from './strategy/github.strategy';

/** Minimal service shape used by the controller to avoid circular deps with domain lib. */
export interface IdentificationServiceShape {
  validateRequired(authorizationHeader: string | undefined): Promise<{ ok: boolean; value?: { uid: string; email?: string; authTime?: unknown; claims?: unknown }; error?: Error & { code?: string } }>;
  validateOptional(authorizationHeader: string | undefined): Promise<{ ok: boolean; value?: { authenticated: boolean; principal?: { uid: string; email?: string } }; error?: Error }>;
  getAvailableMethods(): { provider: string; displayName: string; icon: string; enabled: boolean; authUrl?: string }[];
  signInWithEmailPassword(email: string, password: string): Promise<{ ok: boolean; value?: unknown; error?: Error }>;
  signInAnonymously(): Promise<{ ok: boolean; value?: unknown; error?: Error }>;
  exchangeOAuthCodeForSession(provider: 'google' | 'github', code: string, redirectUri: string, codeVerifier?: string): Promise<{ ok: boolean; value?: unknown; error?: Error }>;
  refresh(refreshToken: string): Promise<{ ok: boolean; value?: unknown; error?: Error }>;
}

export interface AuthenticationControllerDeps {
  identificationService: IdentificationServiceShape;
  ingressAuthSecret: string | undefined;
  swaggerDocument: object;
  oauthConfig: {
    enableGoogle: boolean;
    googleClientId: string | undefined;
    googleClientSecret: string | undefined;
    enableGithub: boolean;
    githubClientId: string | undefined;
    githubClientSecret: string | undefined;
  };
}

export function createAuthenticationRouter(deps: AuthenticationControllerDeps): Router {
  const router = Router();
  const { identificationService, ingressAuthSecret, swaggerDocument, oauthConfig } = deps;
  const {
    enableGoogle,
    googleClientId,
    googleClientSecret,
    enableGithub,
    githubClientId,
    githubClientSecret,
  } = oauthConfig;

  // ===========================================
  // HEALTH & PLATFORM
  // ===========================================

  router.get('/api-docs.json', (req: Request, res: Response) => {
    res.json(swaggerDocument);
  });

  router.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy' });
  });

  router.get('/api/platform', (req: Request, res: Response) => {
    res.status(200).json({
      id: 'authenticator',
      name: 'Authenticator',
      type: 'service',
      runtime: 'express',
      environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'unknown',
      version: process.env.APP_VERSION,
      commitSha: process.env.COMMIT_SHA || process.env.GITHUB_SHA,
      builtAt: process.env.BUILT_AT,
      endpoints: {
        health: '/health',
        docs: '/api-docs',
        openapiJson: '/api-docs.json',
        platform: '/api/platform',
      },
      tags: ['scope:platform', 'layer:auth'],
    });
  });

  // ===========================================
  // VALIDATION (for ingress-nginx)
  // ===========================================

  router.get('/validate', async (req: Request, res: Response) => {
    const result = await identificationService.validateRequired(req.headers.authorization);
    if (!result.ok) {
      console.error('❌ Token validation failed:', result.error.message);

      const code =
        result.error && typeof (result.error as { code?: string }).code === 'string'
          ? (result.error as { code: string }).code
          : undefined;

      if (code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Token expired' });
      }

      if (code === 'auth/argument-error') {
        return res.status(401).json({ error: 'Invalid token format' });
      }

      return res.status(401).json({ error: 'Token validation failed' });
    }

    const principal = result.value;

    res.setHeader('X-User-Id', principal.uid);
    res.setHeader('X-User-Email', principal.email || '');
    res.setHeader('X-Auth-Time', principal.authTime?.toString() || '');

    if (ingressAuthSecret) {
      res.setHeader('X-Ingress-Auth', ingressAuthSecret);
    }

    if (principal.claims) {
      res.setHeader('X-User-Claims', JSON.stringify(principal.claims));
    }

    console.log(`✅ Token validated for user: ${principal.uid}`);

    return res.status(200).json({
      authenticated: true,
      uid: principal.uid,
    });
  });

  router.get('/validate-optional', async (req: Request, res: Response) => {
    const result = await identificationService.validateOptional(req.headers.authorization);

    if (!result.ok || result.value.authenticated !== true) {
      res.setHeader('X-Anonymous', 'true');
      if (ingressAuthSecret) {
        res.setHeader('X-Ingress-Auth', ingressAuthSecret);
      }
      return res.status(200).json({ authenticated: false, anonymous: true });
    }

    const principal = result.value.principal;
    res.setHeader('X-User-Id', principal.uid);
    res.setHeader('X-User-Email', principal.email || '');

    if (ingressAuthSecret) {
      res.setHeader('X-Ingress-Auth', ingressAuthSecret);
    }

    return res.status(200).json({
      authenticated: true,
      uid: principal.uid,
    });
  });

  // ===========================================
  // AUTHENTICATION (for frontend)
  // ===========================================

  router.get('/auth/methods', (req: Request, res: Response) => {
    const methods = identificationService.getAvailableMethods();
    return res.status(200).json({ methods });
  });

  router.post('/auth/signin', async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await identificationService.signInWithEmailPassword(email, password);
    if (!result.ok) {
      const status = result.error.message.includes('not configured') ? 500 : 401;
      return res.status(status).json({ error: result.error.message });
    }

    console.log(`✅ User signed in: ${result.value.uid}`);
    return res.status(200).json(result.value);
  });

  router.post('/auth/signin/anonymous', async (req: Request, res: Response) => {
    const result = await identificationService.signInAnonymously();
    if (!result.ok) {
      if (result.error.message.includes('not enabled')) {
        return res.status(400).json({ error: result.error.message });
      }

      const status = result.error.message.includes('not configured') ? 500 : 401;
      return res.status(status).json({ error: result.error.message });
    }

    console.log(`✅ Anonymous user created: ${result.value.uid}`);
    return res.status(200).json(result.value);
  });

  router.get('/auth/oauth/:provider/authorize', (req: Request, res: Response) => {
    const { provider } = req.params;
    const { redirect_uri, state, code_challenge, code_challenge_method } = req.query;

    if (!redirect_uri) {
      return res.status(400).json({ error: 'redirect_uri is required' });
    }

    let authUrl: string;

    switch (provider.toLowerCase()) {
      case 'google':
        if (!enableGoogle || !googleClientId || !googleClientSecret) {
          return res.status(400).json({ error: 'Google OAuth not configured' });
        }
        authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${googleClientId}` +
          `&redirect_uri=${encodeURIComponent(redirect_uri as string)}` +
          `&response_type=code` +
          `&scope=openid%20email%20profile` +
          `&access_type=offline` +
          `&prompt=consent` +
          (code_challenge ? `&code_challenge=${encodeURIComponent(code_challenge as string)}` : '') +
          (code_challenge_method ? `&code_challenge_method=${encodeURIComponent(code_challenge_method as string)}` : '') +
          (state ? `&state=${encodeURIComponent(state as string)}` : '');
        break;

      case 'github':
        if (!enableGithub || !githubClientId || !githubClientSecret) {
          return res.status(400).json({ error: 'GitHub OAuth not configured' });
        }
        authUrl =
          `https://github.com/login/oauth/authorize?` +
          `client_id=${githubClientId}` +
          `&redirect_uri=${encodeURIComponent(redirect_uri as string)}` +
          `&scope=user:email` +
          (state ? `&state=${encodeURIComponent(state as string)}` : '');
        break;

      default:
        return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

    return res.redirect(authUrl);
  });

  router.post('/auth/signin/oauth', async (req: Request, res: Response) => {
    const { provider, code, redirectUri, codeVerifier } = req.body ?? {};

    if (!provider || !code) {
      return res.status(400).json({ error: 'Provider and code are required' });
    }

    if (!redirectUri) {
      return res.status(400).json({ error: 'redirectUri is required' });
    }

    let strategy: IAuthenticationStrategy;
    if (GoogleAuthenticationStrategy.appliesTo(provider)) {   
      strategy = new GoogleAuthenticationStrategy(code, redirectUri, identityRepository);
    } else if (GitHubAuthenticationStrategy.appliesTo(provider)) {
      strategy = new GitHubAuthenticationStrategy(code, redirectUri, identityRepository);
    }

    if (!strategy) {
      return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }

    const result = await this.identityAuthenticationService.authenticate(strategy);
    
    if (isErr(result)) {
      return res.status(400).json({ error: result.error.message });
    }

    console.log(`✅ OAuth sign in successful for: ${result.value.uid}`);
    return res.status(200).json(result.value);
  });

  router.post('/auth/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = req.body ?? {};

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = await identificationService.refresh(refreshToken);
    if (!result.ok) {
      const status = result.error.message.includes('not configured') ? 500 : 401;
      return res.status(status).json({
        error: status === 401 ? 'Invalid refresh token' : result.error.message,
      });
    }

    return res.status(200).json(result.value);
  });

  router.post('/auth/signout', (req: Request, res: Response) => {
    return res.status(200).json({ message: 'Signed out successfully' });
  });

  return router;
}
