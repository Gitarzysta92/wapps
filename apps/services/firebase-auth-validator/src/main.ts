import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import swaggerUi from 'swagger-ui-express';
import { IdentificationService } from '@domains/identity/identification';
import {
  FirebaseAdminIdTokenVerifier,
  FirebaseAdminUserProvisioner,
  FirebaseRestSessionGateway,
  OAuthCodeExchanger,
  TokenValidationError,
} from '@infrastructure/firebase-identity';
import { PlatformMongoClient } from '@infrastructure/mongo';
import { QueueClient, QueueChannel } from '@infrastructure/platform-queue';
import { IDENTITY_EVENTS_QUEUE_NAME } from '@apps/shared';
import { IdentityProvisioner } from './infrastructure/identity/identity-provisioner';
import { MongoIdentityGraphProvisionerAdapter } from './infrastructure/identity/mongo-identity-graph-provisioner.adapter';
import { EmittingIdentityGraphProvisioner } from './infrastructure/identity/emitting-identity-graph-provisioner';
import { RabbitMqIdentityEventsPublisher } from './infrastructure/identity/rabbitmq-identity-events.publisher';

const app = express();
const PORT = process.env.PORT || 8080;
const INGRESS_AUTH_SECRET = process.env.INGRESS_AUTH_SECRET;

// Firebase configuration
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

// OAuth provider configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// Enabled authentication providers
const ENABLE_EMAIL_PASSWORD = process.env.ENABLE_EMAIL_PASSWORD !== 'false';
const ENABLE_GOOGLE = process.env.ENABLE_GOOGLE === 'true';
const ENABLE_GITHUB = process.env.ENABLE_GITHUB === 'true';
const ENABLE_ANONYMOUS = process.env.ENABLE_ANONYMOUS === 'true';

// Initialize Firebase Admin
admin.initializeApp({
  projectId: FIREBASE_PROJECT_ID,
});

// Optional identity graph (Mongo) - enable by providing MONGO_* env vars
let identityGraphProvisioner: any | undefined;
let identityEventsPublisher: RabbitMqIdentityEventsPublisher | undefined;

// Optional identity events publisher (RabbitMQ) - enable by providing QUEUE_* env vars
if (process.env.QUEUE_HOST && process.env.QUEUE_PORT && process.env.QUEUE_USERNAME && process.env.QUEUE_PASSWORD) {
  const queueClient = new QueueClient();
  void queueClient
    .connect({
      host: process.env.QUEUE_HOST,
      port: process.env.QUEUE_PORT,
      username: process.env.QUEUE_USERNAME,
      password: process.env.QUEUE_PASSWORD,
    })
    .then(async (ch: QueueChannel) => {
      await ch.assertQueue(IDENTITY_EVENTS_QUEUE_NAME);
      identityEventsPublisher = new RabbitMqIdentityEventsPublisher(ch);
      console.log('📣 Identity events enabled (RabbitMQ)');
    })
    .catch((e) => {
      console.warn('⚠️  Identity events disabled (RabbitMQ connect failed):', e?.message ?? e);
    });
}

if (process.env.MONGO_HOST) {
  const mongo = new PlatformMongoClient();
  void mongo
    .connect({
      host: process.env.MONGO_HOST,
      port: process.env.MONGO_PORT,
      username: process.env.MONGO_USERNAME,
      password: process.env.MONGO_PASSWORD,
      database: process.env.MONGO_DATABASE,
    })
    .then(() => {
      const base = new MongoIdentityGraphProvisionerAdapter(new IdentityProvisioner(mongo));
      identityGraphProvisioner =
        identityEventsPublisher ? (new EmittingIdentityGraphProvisioner(base, identityEventsPublisher) as any) : base;
      console.log('🧠 Identity graph provisioning enabled (Mongo)');
    })
    .catch((e) => {
      console.warn('⚠️  Identity graph provisioning disabled (Mongo connect failed):', e?.message ?? e);
    });
}

// Domain wiring (identification-only; no authorization)
const identificationService = new IdentificationService(
  new FirebaseAdminIdTokenVerifier(),
  new FirebaseRestSessionGateway(FIREBASE_WEB_API_KEY),
  new FirebaseAdminUserProvisioner(),
  new OAuthCodeExchanger({
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    githubClientId: GITHUB_CLIENT_ID,
    githubClientSecret: GITHUB_CLIENT_SECRET,
  }),
  {
    enabledEmailPassword: ENABLE_EMAIL_PASSWORD,
    enabledGoogle: ENABLE_GOOGLE,
    enabledGithub: ENABLE_GITHUB,
    enabledAnonymous: ENABLE_ANONYMOUS,
    googleClientId: GOOGLE_CLIENT_ID,
    githubClientId: GITHUB_CLIENT_ID,
    firebaseWebApiKey: FIREBASE_WEB_API_KEY,
  },
  () => identityGraphProvisioner
);

// Middleware
app.use(express.json());

// CORS middleware for frontend access
app.use((req: Request, res: Response, next) => {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const origin = req.headers.origin;
  
  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return next();
});

// Validate configuration
if (!INGRESS_AUTH_SECRET) {
  console.warn('⚠️  WARNING: INGRESS_AUTH_SECRET not set - backend services cannot validate auth headers!');
}

if (!FIREBASE_WEB_API_KEY) {
  console.warn('⚠️  WARNING: FIREBASE_WEB_API_KEY not set - email/password authentication will not work!');
}

// Swagger documentation
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Firebase Auth Validator API',
    version: '2.0.0',
    description: 'Authentication BFF service for Firebase. Handles token validation for ingress-nginx and authentication flows for frontend apps.',
    contact: {
      name: 'Platform Team'
    }
  },
  servers: [
    {
      url: '/',
      description: 'Current host'
    }
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints'
    },
    {
      name: 'Validation',
      description: 'Token validation endpoints for ingress-nginx'
    },
    {
      name: 'Authentication',
      description: 'Authentication endpoints for frontend apps'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase ID token'
      }
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'healthy' }
        }
      },
      ValidateSuccessResponse: {
        type: 'object',
        properties: {
          authenticated: { type: 'boolean', example: true },
          uid: { type: 'string', example: 'abc123xyz' }
        }
      },
      ValidateOptionalResponse: {
        type: 'object',
        properties: {
          authenticated: { type: 'boolean' },
          uid: { type: 'string', nullable: true },
          anonymous: { type: 'boolean', nullable: true }
        }
      },
      SignInRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 6, example: 'password123' }
        }
      },
      SignInResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Firebase ID token' },
          refreshToken: { type: 'string', description: 'Refresh token for getting new ID tokens' },
          expiresIn: { type: 'string', description: 'Token expiration time in seconds' },
          uid: { type: 'string', description: 'User ID' }
        }
      },
      OAuthExchangeRequest: {
        type: 'object',
        required: ['provider', 'code'],
        properties: {
          provider: { type: 'string', enum: ['google', 'github'], example: 'google' },
          code: { type: 'string', description: 'OAuth authorization code' },
          redirectUri: { type: 'string', description: 'Redirect URI used in OAuth flow' }
        }
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', description: 'Refresh token from sign-in response' }
        }
      },
      AuthMethod: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['EMAIL_PASSWORD', 'GOOGLE', 'GITHUB', 'ANONYMOUS'] },
          displayName: { type: 'string' },
          icon: { type: 'string' },
          enabled: { type: 'boolean' },
          authUrl: { type: 'string', nullable: true }
        }
      },
      AuthMethodsResponse: {
        type: 'object',
        properties: {
          methods: {
            type: 'array',
            items: { $ref: '#/components/schemas/AuthMethod' }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Authentication failed' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } }
          }
        }
      }
    },
    '/validate': {
      get: {
        tags: ['Validation'],
        summary: 'Validate Firebase token (required)',
        description: 'Validates Firebase ID token from Authorization header. Used by ingress-nginx external auth.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Token is valid', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidateSuccessResponse' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/validate-optional': {
      get: {
        tags: ['Validation'],
        summary: 'Validate Firebase token (optional)',
        description: 'Validates token if present, allows anonymous access otherwise.',
        responses: {
          '200': { description: 'Token validated or anonymous access', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidateOptionalResponse' } } } }
        }
      }
    },
    '/auth/methods': {
      get: {
        tags: ['Authentication'],
        summary: 'Get available authentication methods',
        description: 'Returns list of enabled authentication providers.',
        responses: {
          '200': { description: 'List of authentication methods', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthMethodsResponse' } } } }
        }
      }
    },
    '/auth/signin': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign in with email and password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInRequest' } } }
        },
        responses: {
          '200': { description: 'Sign in successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInResponse' } } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/auth/signin/oauth': {
      post: {
        tags: ['Authentication'],
        summary: 'Exchange OAuth code for Firebase token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OAuthExchangeRequest' } } }
        },
        responses: {
          '200': { description: 'Sign in successful', content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInResponse' } } } },
          '401': { description: 'OAuth failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh authentication token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } }
        },
        responses: {
          '200': { description: 'Token refreshed', content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInResponse' } } } },
          '401': { description: 'Invalid refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/auth/oauth/{provider}/authorize': {
      get: {
        tags: ['Authentication'],
        summary: 'Get OAuth authorization URL',
        parameters: [
          { name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['google', 'github'] } },
          { name: 'redirect_uri', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '302': { description: 'Redirect to OAuth provider' },
          '400': { description: 'Invalid provider' }
        }
      }
    }
  }
};

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'Firebase Auth Validator API',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// ===========================================
// HEALTH CHECK
// ===========================================

// Serve raw OpenAPI spec as JSON
app.get('/api-docs.json', (req: Request, res: Response) => {
  res.json(swaggerDocument);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

// Platform manifest (used by platform-portal-bff for enrichment)
app.get('/api/platform', (req: Request, res: Response) => {
  res.status(200).json({
    id: 'firebase-auth-validator',
    name: 'Firebase Auth Validator',
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
// VALIDATION ENDPOINTS (for ingress-nginx)
// ===========================================

app.get('/validate', async (req: Request, res: Response) => {
  const result = await identificationService.validateRequired(req.headers.authorization);
  if (!result.ok) {
    console.error('❌ Token validation failed:', result.error.message);

    const code =
      result.error instanceof TokenValidationError
        ? result.error.code
        : (result.error as any)?.code;

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

  if (INGRESS_AUTH_SECRET) {
    res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
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

app.get('/validate-optional', async (req: Request, res: Response) => {
  const result = await identificationService.validateOptional(req.headers.authorization);

  if (!result.ok || result.value.authenticated !== true) {
    res.setHeader('X-Anonymous', 'true');
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    return res.status(200).json({ authenticated: false, anonymous: true });
  }

  const principal = result.value.principal;
  res.setHeader('X-User-Id', principal.uid);
  res.setHeader('X-User-Email', principal.email || '');

  if (INGRESS_AUTH_SECRET) {
    res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
  }

  return res.status(200).json({
    authenticated: true,
    uid: principal.uid,
  });
});

// ===========================================
// AUTHENTICATION ENDPOINTS (for frontend)
// ===========================================

/**
 * Get available authentication methods
 */
app.get('/auth/methods', (req: Request, res: Response) => {
  const methods = identificationService.getAvailableMethods();
  return res.status(200).json({ methods });
});

/**
 * Sign in with email and password
 */
app.post('/auth/signin', async (req: Request, res: Response) => {
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

/**
 * Sign in anonymously
 */
app.post('/auth/signin/anonymous', async (req: Request, res: Response) => {
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

/**
 * OAuth authorization URL redirect
 */
app.get('/auth/oauth/:provider/authorize', (req: Request, res: Response) => {
  const { provider } = req.params;
  const { redirect_uri, state } = req.query;
  
  if (!redirect_uri) {
    return res.status(400).json({ error: 'redirect_uri is required' });
  }
  
  let authUrl: string;
  
  switch (provider.toLowerCase()) {
    case 'google':
      if (!GOOGLE_CLIENT_ID) {
        return res.status(400).json({ error: 'Google OAuth not configured' });
      }
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirect_uri as string)}` +
        `&response_type=code` +
        `&scope=email%20profile` +
        `&access_type=offline` +
        (state ? `&state=${encodeURIComponent(state as string)}` : '');
      break;
      
    case 'github':
      if (!GITHUB_CLIENT_ID) {
        return res.status(400).json({ error: 'GitHub OAuth not configured' });
      }
      authUrl = `https://github.com/login/oauth/authorize?` +
        `client_id=${GITHUB_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirect_uri as string)}` +
        `&scope=user:email` +
        (state ? `&state=${encodeURIComponent(state as string)}` : '');
      break;
      
    default:
      return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }
  
  return res.redirect(authUrl);
});

/**
 * Exchange OAuth code for Firebase token
 */
app.post('/auth/signin/oauth', async (req: Request, res: Response) => {
  const { provider, code, redirectUri } = req.body ?? {};

  if (!provider || !code) {
    return res.status(400).json({ error: 'Provider and code are required' });
  }

  if (!redirectUri) {
    return res.status(400).json({ error: 'redirectUri is required' });
  }

  const normalizedProvider = String(provider).toLowerCase();
  if (normalizedProvider !== 'google' && normalizedProvider !== 'github') {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  const result = await identificationService.exchangeOAuthCodeForSession(
    normalizedProvider as 'google' | 'github',
    code,
    redirectUri
  );

  if (!result.ok) {
    const status = result.error.message.includes('incomplete') ? 500 : 401;
    return res.status(status).json({ error: result.error.message || 'OAuth authentication failed' });
  }

  console.log(`✅ OAuth sign in successful for: ${result.value.uid}`);
  return res.status(200).json(result.value);
});

/**
 * Refresh token
 */
app.post('/auth/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  const result = await identificationService.refresh(refreshToken);
  if (!result.ok) {
    const status = result.error.message.includes('not configured') ? 500 : 401;
    return res.status(status).json({ error: status === 401 ? 'Invalid refresh token' : result.error.message });
  }

  return res.status(200).json(result.value);
});

/**
 * Sign out (for cleanup if needed)
 */
app.post('/auth/signout', async (req: Request, res: Response) => {
  // Optionally revoke refresh tokens server-side
  // For now, just acknowledge the sign out
  return res.status(200).json({ message: 'Signed out successfully' });
});

// ===========================================
// START SERVER
// ===========================================

app.listen(PORT, () => {
  console.log(`🔐 Firebase Auth Validator running on port ${PORT}`);
  console.log(`📋 Firebase Project ID: ${FIREBASE_PROJECT_ID || 'NOT SET'}`);
  console.log(`📋 Firebase Web API Key: ${FIREBASE_WEB_API_KEY ? '✓ SET' : '✗ NOT SET'}`);
  console.log(`📋 Enabled providers:`);
  console.log(`   - Email/Password: ${ENABLE_EMAIL_PASSWORD ? '✓' : '✗'}`);
  console.log(`   - Google: ${ENABLE_GOOGLE && GOOGLE_CLIENT_ID ? '✓' : '✗'}`);
  console.log(`   - GitHub: ${ENABLE_GITHUB && GITHUB_CLIENT_ID ? '✓' : '✗'}`);
  console.log(`   - Anonymous: ${ENABLE_ANONYMOUS ? '✓' : '✗'}`);
});
