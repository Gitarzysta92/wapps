/**
 * Kept as a plain OpenAPI document to preserve current API surface
 * (this service historically served Swagger UI using swagger-ui-express).
 */
export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Firebase Auth Validator API',
    version: '2.0.0',
    description:
      'Authentication BFF service for Firebase. Handles token validation for ingress-nginx and authentication flows for frontend apps.',
    contact: {
      name: 'Platform Team',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current host',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Validation',
      description: 'Token validation endpoints for ingress-nginx',
    },
    {
      name: 'Authentication',
      description: 'Authentication endpoints for frontend apps',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Firebase ID token',
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'healthy' },
        },
      },
      ValidateSuccessResponse: {
        type: 'object',
        properties: {
          authenticated: { type: 'boolean', example: true },
          uid: { type: 'string', example: 'abc123xyz' },
        },
      },
      ValidateOptionalResponse: {
        type: 'object',
        properties: {
          authenticated: { type: 'boolean' },
          uid: { type: 'string', nullable: true },
          anonymous: { type: 'boolean', nullable: true },
        },
      },
      SignInRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 6, example: 'password123' },
        },
      },
      SignInResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Firebase ID token' },
          refreshToken: { type: 'string', description: 'Refresh token for getting new ID tokens' },
          expiresIn: { type: 'string', description: 'Token expiration time in seconds' },
          uid: { type: 'string', description: 'User ID' },
        },
      },
      OAuthExchangeRequest: {
        type: 'object',
        required: ['provider', 'code'],
        properties: {
          provider: { type: 'string', enum: ['google', 'github'], example: 'google' },
          code: { type: 'string', description: 'OAuth authorization code' },
          redirectUri: { type: 'string', description: 'Redirect URI used in OAuth flow' },
          codeVerifier: { type: 'string', nullable: true, description: 'PKCE code_verifier (optional)' },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string', description: 'Refresh token from sign-in response' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Authentication failed' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },
    '/validate': {
      get: {
        tags: ['Validation'],
        summary: 'Validate Firebase token (required)',
        description: 'Validates Firebase ID token from Authorization header. Used by ingress-nginx external auth.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Token is valid',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidateSuccessResponse' } } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/validate-optional': {
      get: {
        tags: ['Validation'],
        summary: 'Validate Firebase token (optional)',
        description: 'Validates token if present, allows anonymous access otherwise.',
        responses: {
          '200': {
            description: 'Token validated or anonymous access',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidateOptionalResponse' } } },
          },
        },
      },
    },
    '/auth/signin': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign in with email and password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInRequest' } } },
        },
        responses: {
          '200': {
            description: 'Sign in successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInResponse' } } },
          },
          '401': {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/signin/oauth': {
      post: {
        tags: ['Authentication'],
        summary: 'Exchange OAuth code for Firebase token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OAuthExchangeRequest' } } },
        },
        responses: {
          '200': {
            description: 'Sign in successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInResponse' } } },
          },
          '401': {
            description: 'OAuth failed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh authentication token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshTokenRequest' } } },
        },
        responses: {
          '200': {
            description: 'Token refreshed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SignInResponse' } } },
          },
          '401': {
            description: 'Invalid refresh token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/auth/oauth/google/authorize': {
      get: {
        tags: ['Authentication'],
        summary: 'Redirect to Google OAuth authorization',
        parameters: [
          { name: 'redirect_uri', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'code_challenge', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'code_challenge_method', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '302': { description: 'Redirect to Google OAuth' },
          '400': { description: 'Missing redirect_uri or Google OAuth not enabled' },
          '500': { description: 'Google OAuth misconfigured' },
        },
      },
    },
    '/auth/oauth/github/authorize': {
      get: {
        tags: ['Authentication'],
        summary: 'Redirect to GitHub OAuth authorization',
        parameters: [
          { name: 'redirect_uri', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'state', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '302': { description: 'Redirect to GitHub OAuth' },
          '400': { description: 'Missing redirect_uri or GitHub OAuth not enabled' },
          '500': { description: 'GitHub OAuth misconfigured' },
        },
      },
    },
  },
} as const;

