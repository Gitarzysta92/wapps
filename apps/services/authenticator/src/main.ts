import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import swaggerUi from 'swagger-ui-express';
import { IIdentityGraphProvisioner, IdentityAuthenticationServiceV2, IdentityService } from '@domains/identity/authentication';
import { v7 as uuidv7 } from 'uuid';
import {
  FirebaseAdminIdTokenVerifier,
  FirebaseAdminUserProvisioner,
  FirebaseRestSessionGateway,
  OAuthCodeExchanger,
} from '@infrastructure/firebase-identity';
import { MysqlClient, MysqlIdentitySubjectRepository } from '@infrastructure/mysql';
import { PlatformMongoClient } from '@infrastructure/mongo';
import { QueueClient, QueueChannel } from '@infrastructure/platform-queue';
import { IDENTITY_EVENTS_QUEUE_NAME } from '@apps/shared';
import { MongoIdentityNodeRepository } from './infrastructure/identity/identity-provisioner';
import { MongoIdentityGraphProvisionerAdapter } from './infrastructure/identity/mongo-identity-graph-provisioner.adapter';
import { EmittingIdentityGraphProvisioner } from './infrastructure/identity/emitting-identity-graph-provisioner';
import { RabbitMqIdentityEventsPublisher } from './infrastructure/identity/rabbitmq-identity-events.publisher';
import { createAuthenticationRouter } from './authentication.controller';


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
// admin.initializeApp({
//   projectId: FIREBASE_PROJECT_ID,
// });

// Optional identity graph (Mongo) - enable by providing MONGO_* env vars
let identityGraphProvisioner: IIdentityGraphProvisioner | undefined;
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
  const hasMysql =
    process.env.MYSQL_HOST &&
    process.env.MYSQL_PORT &&
    process.env.MYSQL_USERNAME &&
    process.env.MYSQL_PASSWORD &&
    process.env.MYSQL_DATABASE;

  if (!hasMysql) {
    console.warn(
      '⚠️  Identity graph provisioning disabled: MySQL subject store not configured (set MYSQL_HOST, MYSQL_PORT, MYSQL_USERNAME, MYSQL_PASSWORD, MYSQL_DATABASE)'
    );
  } else {
    const mysql = new MysqlClient();
    const pool = mysql.connect({
      host: process.env.MYSQL_HOST as string,
      port: parseInt(process.env.MYSQL_PORT as string, 10),
      user: process.env.MYSQL_USERNAME as string,
      password: process.env.MYSQL_PASSWORD as string,
      database: process.env.MYSQL_DATABASE as string,
    });
    const subjectsRepo = new MysqlIdentitySubjectRepository(pool);

    void Promise.all([
      mongo.connect({
        host: process.env.MONGO_HOST,
        port: process.env.MONGO_PORT,
        username: process.env.MONGO_USERNAME,
        password: process.env.MONGO_PASSWORD,
        database: process.env.MONGO_DATABASE,
      }),
      subjectsRepo.ensureSchema().then((r) => {
        if (!r.ok) throw r.error;
      }),
    ])
      .then(() => {
        const nodesRepo = new MongoIdentityNodeRepository(mongo);
        const ids = { generate: () => uuidv7() };
        const identityService = new IdentityService(nodesRepo, subjectsRepo, ids);
        const base = new MongoIdentityGraphProvisionerAdapter(identityService);
        identityGraphProvisioner =
          identityEventsPublisher ? new EmittingIdentityGraphProvisioner(base, identityEventsPublisher) : base;
        console.log('🧠 Identity provisioning enabled (Mongo graph + MySQL subjects)');
      })
      .catch((e) => {
        console.warn('⚠️  Identity graph provisioning disabled (bootstrap failed):', e?.message ?? e);
      });
  }
}

// Domain wiring (identification-only; no authorization)
const identificationService = new IdentityAuthenticationServiceV2(
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
    identityProvider: 'firebase',
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    githubClientId: GITHUB_CLIENT_ID,
    githubClientSecret: GITHUB_CLIENT_SECRET,
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
          redirectUri: { type: 'string', description: 'Redirect URI used in OAuth flow' },
          codeVerifier: { type: 'string', nullable: true, description: 'PKCE code_verifier (optional)' }
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

// Mount authentication controller (health, validation, auth endpoints)
const authenticationRouter = createAuthenticationRouter({
  identificationService,
  ingressAuthSecret: INGRESS_AUTH_SECRET,
  swaggerDocument,
  oauthConfig: {
    enableGoogle: ENABLE_GOOGLE,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
    enableGithub: ENABLE_GITHUB,
    githubClientId: GITHUB_CLIENT_ID,
    githubClientSecret: GITHUB_CLIENT_SECRET,
  },
});
app.use(authenticationRouter);

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
















// getAvailableMethods(): AuthenticationMethodDto[] {
//   const methods: AuthenticationMethodDto[] = [];

//   if (this.config.enabledEmailPassword) {
//     methods.push({
//       provider: AuthenticationProvider.EMAIL_PASSWORD,
//       displayName: 'Email & Password',
//       icon: 'mail',
//       enabled: true,
//     });
//   }

//   if (this.config.enabledGoogle && this.config.googleClientId && this.config.googleClientSecret) {
//     methods.push({
//       provider: AuthenticationProvider.GOOGLE,
//       displayName: 'Google',
//       icon: 'google',
//       enabled: true,
//       authUrl: '/auth/oauth/google/authorize',
//     });
//   }

//   if (this.config.enabledGithub && this.config.githubClientId && this.config.githubClientSecret) {
//     methods.push({
//       provider: AuthenticationProvider.GITHUB,
//       displayName: 'GitHub',
//       icon: 'github',
//       enabled: true,
//       authUrl: '/auth/oauth/github/authorize',
//     });
//   }

//   if (this.config.enabledAnonymous) {
//     methods.push({
//       provider: AuthenticationProvider.ANONYMOUS,
//       displayName: 'Continue as Guest',
//       icon: 'user',
//       enabled: true,
//     });
//   }

//   return methods;
// }
