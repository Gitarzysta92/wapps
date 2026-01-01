import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import swaggerUi from 'swagger-ui-express';
import fetch from 'node-fetch';

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

// ===========================================
// VALIDATION ENDPOINTS (for ingress-nginx)
// ===========================================

app.get('/validate', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('No Authorization header provided');
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!token || token === authHeader) {
      console.log('Invalid Authorization header format');
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    
    res.setHeader('X-User-Id', decodedToken.uid);
    res.setHeader('X-User-Email', decodedToken.email || '');
    res.setHeader('X-Auth-Time', decodedToken.auth_time?.toString() || '');
    
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    
    if (decodedToken.custom_claims) {
      res.setHeader('X-User-Claims', JSON.stringify(decodedToken.custom_claims));
    }
    
    console.log(`✅ Token validated for user: ${decodedToken.uid}`);
    
    return res.status(200).json({ 
      authenticated: true,
      uid: decodedToken.uid 
    });
    
  } catch (error: any) {
    console.error('❌ Token validation failed:', error.message);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    return res.status(401).json({ error: 'Token validation failed' });
  }
});

app.get('/validate-optional', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.setHeader('X-Anonymous', 'true');
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    return res.status(200).json({ authenticated: false, anonymous: true });
  }

  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    res.setHeader('X-User-Id', decodedToken.uid);
    res.setHeader('X-User-Email', decodedToken.email || '');
    
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    
    return res.status(200).json({ 
      authenticated: true,
      uid: decodedToken.uid 
    });
  } catch (error) {
    res.setHeader('X-Anonymous', 'true');
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    return res.status(200).json({ authenticated: false, anonymous: true });
  }
});

// ===========================================
// AUTHENTICATION ENDPOINTS (for frontend)
// ===========================================

/**
 * Get available authentication methods
 */
app.get('/auth/methods', (req: Request, res: Response) => {
  const methods = [];
  
  if (ENABLE_EMAIL_PASSWORD) {
    methods.push({
      provider: 'EMAIL_PASSWORD',
      displayName: 'Email & Password',
      icon: 'mail',
      enabled: true
    });
  }
  
  if (ENABLE_GOOGLE && GOOGLE_CLIENT_ID) {
    methods.push({
      provider: 'GOOGLE',
      displayName: 'Google',
      icon: 'google',
      enabled: true,
      authUrl: '/auth/oauth/google/authorize'
    });
  }
  
  if (ENABLE_GITHUB && GITHUB_CLIENT_ID) {
    methods.push({
      provider: 'GITHUB',
      displayName: 'GitHub',
      icon: 'github',
      enabled: true,
      authUrl: '/auth/oauth/github/authorize'
    });
  }
  
  if (ENABLE_ANONYMOUS) {
    methods.push({
      provider: 'ANONYMOUS',
      displayName: 'Continue as Guest',
      icon: 'user',
      enabled: true
    });
  }
  
  return res.status(200).json({ methods });
});

/**
 * Sign in with email and password
 */
app.post('/auth/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (!FIREBASE_WEB_API_KEY) {
      return res.status(500).json({ error: 'Email/password authentication not configured' });
    }
    
    const firebaseAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;
    
    const response = await fetch(firebaseAuthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      console.error('Firebase auth error:', errorData);
      
      const errorMessage = mapFirebaseError(errorData.error?.message);
      return res.status(401).json({ error: errorMessage });
    }

    const data = await response.json() as any;
    
    console.log(`✅ User signed in: ${data.localId}`);
    
    return res.status(200).json({
      token: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      uid: data.localId
    });

  } catch (error: any) {
    console.error('Sign in error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * Sign in anonymously
 */
app.post('/auth/signin/anonymous', async (req: Request, res: Response) => {
  try {
    if (!ENABLE_ANONYMOUS) {
      return res.status(400).json({ error: 'Anonymous authentication not enabled' });
    }
    
    if (!FIREBASE_WEB_API_KEY) {
      return res.status(500).json({ error: 'Anonymous authentication not configured' });
    }
    
    const firebaseAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_WEB_API_KEY}`;
    
    const response = await fetch(firebaseAuthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnSecureToken: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      console.error('Firebase anonymous auth error:', errorData);
      return res.status(401).json({ error: 'Anonymous authentication failed' });
    }

    const data = await response.json() as any;
    
    console.log(`✅ Anonymous user created: ${data.localId}`);
    
    return res.status(200).json({
      token: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      uid: data.localId
    });

  } catch (error: any) {
    console.error('Anonymous sign in error:', error);
    return res.status(500).json({ error: 'Anonymous authentication failed' });
  }
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
  try {
    const { provider, code, redirectUri } = req.body;
    
    if (!provider || !code) {
      return res.status(400).json({ error: 'Provider and code are required' });
    }
    
    let userInfo: { email: string; name?: string; picture?: string; emailVerified?: boolean };
    
    switch (provider.toLowerCase()) {
      case 'google':
        userInfo = await exchangeGoogleCode(code, redirectUri);
        break;
        
      case 'github':
        userInfo = await exchangeGitHubCode(code, redirectUri);
        break;
        
      default:
        return res.status(400).json({ error: `Unknown provider: ${provider}` });
    }
    
    // Get or create Firebase user
    let firebaseUser: admin.auth.UserRecord;
    try {
      firebaseUser = await admin.auth().getUserByEmail(userInfo.email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        firebaseUser = await admin.auth().createUser({
          email: userInfo.email,
          displayName: userInfo.name,
          photoURL: userInfo.picture,
          emailVerified: userInfo.emailVerified ?? true
        });
        console.log(`✅ Created new Firebase user: ${firebaseUser.uid}`);
      } else {
        throw error;
      }
    }
    
    // Create custom token
    const customToken = await admin.auth().createCustomToken(firebaseUser.uid);
    
    // Exchange custom token for ID token
    if (!FIREBASE_WEB_API_KEY) {
      return res.status(500).json({ error: 'Firebase configuration incomplete' });
    }
    
    const tokenUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`;
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Custom token exchange error:', errorData);
      return res.status(500).json({ error: 'Failed to create session' });
    }
    
    const tokenData = await tokenResponse.json() as any;
    
    console.log(`✅ OAuth sign in successful for: ${firebaseUser.uid}`);
    
    return res.status(200).json({
      token: tokenData.idToken,
      refreshToken: tokenData.refreshToken,
      expiresIn: tokenData.expiresIn,
      uid: firebaseUser.uid
    });
    
  } catch (error: any) {
    console.error('OAuth sign in error:', error);
    return res.status(401).json({ error: error.message || 'OAuth authentication failed' });
  }
});

/**
 * Refresh token
 */
app.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    if (!FIREBASE_WEB_API_KEY) {
      return res.status(500).json({ error: 'Token refresh not configured' });
    }
    
    const refreshUrl = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_WEB_API_KEY}`;
    
    const response = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Token refresh error:', errorData);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const data = await response.json() as any;
    
    return res.status(200).json({
      token: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      uid: data.user_id
    });
    
  } catch (error: any) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
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
// HELPER FUNCTIONS
// ===========================================

async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ email: string; name?: string; picture?: string; emailVerified?: boolean }> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth not configured');
  }
  
  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }).toString()
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.json();
    console.error('Google token exchange error:', error);
    throw new Error('Failed to exchange Google authorization code');
  }
  
  const tokens = await tokenResponse.json() as any;
  
  // Get user info from ID token
  const userInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokens.id_token}`);
  
  if (!userInfoResponse.ok) {
    throw new Error('Failed to get Google user info');
  }
  
  const userInfo = await userInfoResponse.json() as any;
  
  return {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    emailVerified: userInfo.email_verified === 'true'
  };
}

async function exchangeGitHubCode(code: string, redirectUri: string): Promise<{ email: string; name?: string; picture?: string }> {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    throw new Error('GitHub OAuth not configured');
  }
  
  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      code,
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      redirect_uri: redirectUri
    })
  });
  
  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange GitHub authorization code');
  }
  
  const tokens = await tokenResponse.json() as any;
  
  if (tokens.error) {
    console.error('GitHub token error:', tokens);
    throw new Error(tokens.error_description || 'GitHub authentication failed');
  }
  
  // Get user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (!userResponse.ok) {
    throw new Error('Failed to get GitHub user info');
  }
  
  const user = await userResponse.json() as any;
  
  // Get user emails (in case primary email is private)
  const emailsResponse = await fetch('https://api.github.com/user/emails', {
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  let email = user.email;
  
  if (!email && emailsResponse.ok) {
    const emails = await emailsResponse.json() as any[];
    const primaryEmail = emails.find(e => e.primary && e.verified);
    email = primaryEmail?.email || emails[0]?.email;
  }
  
  if (!email) {
    throw new Error('Could not get email from GitHub account');
  }
  
  return {
    email,
    name: user.name || user.login,
    picture: user.avatar_url
  };
}

function mapFirebaseError(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'EMAIL_NOT_FOUND': 'No account found with this email',
    'INVALID_PASSWORD': 'Incorrect password',
    'INVALID_LOGIN_CREDENTIALS': 'Invalid email or password',
    'USER_DISABLED': 'This account has been disabled',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'Too many failed attempts. Please try again later',
    'EMAIL_EXISTS': 'An account with this email already exists',
    'WEAK_PASSWORD': 'Password should be at least 6 characters',
    'INVALID_EMAIL': 'Invalid email address'
  };

  return errorMessages[errorCode] || 'Authentication failed. Please try again';
}

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
