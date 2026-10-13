/**
 * Kept as a plain OpenAPI document to preserve current API surface
 * (this service historically served Swagger UI using swagger-ui-express).
 */
export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Authenticator API',
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
      RegisterRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'nickname', 'password', 'passwordConfirmation'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          nickname: { type: 'string', minLength: 1, maxLength: 120 },
          password: {
            type: 'string',
            minLength: 6,
            maxLength: 128,
            writeOnly: true,
          },
          passwordConfirmation: {
            type: 'string',
            minLength: 6,
            maxLength: 128,
            writeOnly: true,
          },
        },
      },
      VerifyPasswordResetRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['code'],
        properties: {
          code: {
            type: 'string',
            pattern: '^[A-Za-z0-9_-]{1,2048}$',
            writeOnly: true,
          },
        },
      },
      CompletePasswordResetRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'password', 'passwordConfirmation'],
        properties: {
          code: {
            type: 'string',
            pattern: '^[A-Za-z0-9_-]{1,2048}$',
            writeOnly: true,
          },
          password: {
            type: 'string',
            minLength: 6,
            maxLength: 128,
            writeOnly: true,
          },
          passwordConfirmation: {
            type: 'string',
            minLength: 6,
            maxLength: 128,
            writeOnly: true,
          },
        },
      },
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
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com',
          },
          password: { type: 'string', minLength: 6, example: 'password123' },
        },
      },
      SignInResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Firebase ID token' },
          refreshToken: {
            type: 'string',
            description: 'Refresh token for getting new ID tokens',
          },
          expiresIn: {
            type: 'string',
            description: 'Token expiration time in seconds',
          },
          uid: { type: 'string', description: 'User ID' },
        },
      },
      OAuthExchangeRequest: {
        type: 'object',
        required: ['provider', 'code'],
        properties: {
          provider: {
            type: 'string',
            enum: ['google', 'github'],
            example: 'google',
          },
          code: { type: 'string', description: 'OAuth authorization code' },
          redirectUri: {
            type: 'string',
            description: 'Redirect URI used in OAuth flow',
          },
          codeVerifier: {
            type: 'string',
            nullable: true,
            description: 'PKCE code_verifier (optional)',
          },
        },
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: {
            type: 'string',
            description: 'Refresh token from sign-in response',
          },
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
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Create credentials and enroll an initial canonical account',
        description:
          'Existing credentials are verified to recover interrupted signup. Initial enrollment is idempotent and cannot overwrite an existing profile. SQL restrictions remain authoritative. A session is returned only after durable authentication recording. Provider and SQL commits are separate; retry with the same key and details or sign in after an ambiguous failure.',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', minLength: 1, maxLength: 128 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Canonical account enrolled; response is not cacheable',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SignInResponse' },
              },
            },
          },
          '400': { description: 'Invalid input or rejected credentials' },
          '403': { description: 'Restricted identity or disabled feature' },
          '409': {
            description:
              'Conflicting enrollment or already registered account; sign in',
          },
          '503': {
            description:
              'Provider or SQL unavailable; completion may be ambiguous',
          },
        },
      },
    },
    '/auth/password-reset/verify': {
      post: {
        tags: ['Authentication'],
        summary: 'Check a provider reset action code without consuming it',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VerifyPasswordResetRequest',
              },
            },
          },
        },
        responses: {
          '200': { description: 'Code currently valid; email is not returned' },
          '400': { description: 'Invalid, expired or used code' },
          '403': { description: 'Feature disabled' },
          '503': { description: 'Provider unavailable' },
        },
      },
    },
    '/auth/password-reset/complete': {
      post: {
        tags: ['Authentication'],
        summary: 'Consume a provider reset action code and set a new password',
        description:
          'Does not create or reactivate a canonical identity. A provider commit followed by network failure is ambiguous; try signing in with the new password or request another link. Used codes are rejected.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CompletePasswordResetRequest',
              },
            },
          },
        },
        responses: {
          '200': { description: 'Password changed' },
          '400': {
            description:
              'Invalid code, mismatched passwords or password policy rejection',
          },
          '403': { description: 'Feature disabled' },
          '503': {
            description: 'Provider unavailable; completion may be ambiguous',
          },
        },
      },
    },
    '/auth/email-verification/status': {
      get: {
        tags: ['Authentication'],
        summary: 'Read current verification of my sign-in email',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description:
              'Provider-authoritative email (nullable) and verified boolean; no-store',
          },
          '401': {
            description:
              'Invalid, revoked, disabled or unavailable canonical identity',
          },
          '429': { description: 'Provider throttled' },
          '503': { description: 'Identity or credential provider unavailable' },
        },
      },
    },
    '/auth/email-verification/request': {
      post: {
        tags: ['Authentication'],
        summary: 'Request a verification email for my current credential',
        description:
          'No caller-selected email or UID. Returns requested or already-verified; acceptance does not prove delivery. No automatic retry after an uncertain response.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description:
              'Request accepted or credential already verified; no-store',
          },
          '400': { description: 'Credential has no email' },
          '401': { description: 'Session or canonical identity rejected' },
          '429': { description: 'Provider throttled' },
          '503': { description: 'Uncertain outcome or unavailable dependency' },
        },
      },
    },
    '/auth/email-verification/verify': {
      post: {
        tags: ['Authentication'],
        summary: 'Inspect a VERIFY_EMAIL action code without consuming it',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VerifyPasswordResetRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Code currently valid; target email is not returned',
          },
          '400': { description: 'Invalid, expired, used or wrong action type' },
          '429': { description: 'Provider throttled' },
          '503': { description: 'Provider unavailable' },
        },
      },
    },
    '/auth/email-verification/complete': {
      post: {
        tags: ['Authentication'],
        summary: 'Explicitly consume a VERIFY_EMAIL action code',
        description:
          'Grants no session, application permission or canonical lifecycle change. A lost response may follow success; refresh self status before requesting another link.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/VerifyPasswordResetRequest',
              },
            },
          },
        },
        responses: {
          '200': { description: 'Email verification confirmed; no-store' },
          '400': { description: 'Invalid, expired, used or wrong action type' },
          '401': { description: 'Provider account rejected' },
          '429': { description: 'Provider throttled' },
          '503': {
            description: 'Uncertain completion or provider unavailable',
          },
        },
      },
    },
    '/auth/methods': {
      get: {
        tags: ['Authentication'],
        summary: 'List enabled sign-in methods',
        responses: { '200': { description: 'Enabled authentication methods' } },
      },
    },
    '/auth/signout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke refresh tokens for the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Sessions revoked' },
          '401': { description: 'Invalid session' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/validate': {
      get: {
        tags: ['Validation'],
        summary: 'Validate Firebase token (required)',
        description:
          'Validates Firebase ID token from Authorization header. Used by ingress-nginx external auth.',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Token is valid',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidateSuccessResponse',
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/validate-optional': {
      get: {
        tags: ['Validation'],
        summary: 'Validate Firebase token (optional)',
        description:
          'Validates token if present, allows anonymous access otherwise.',
        responses: {
          '200': {
            description: 'Token validated or anonymous access',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidateOptionalResponse',
                },
              },
            },
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
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SignInRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sign in successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SignInResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
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
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OAuthExchangeRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sign in successful',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SignInResponse' },
              },
            },
          },
          '401': {
            description: 'OAuth failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
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
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RefreshTokenRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token refreshed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SignInResponse' },
              },
            },
          },
          '401': {
            description: 'Invalid refresh token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/auth/oauth/google/authorize': {
      get: {
        tags: ['Authentication'],
        summary: 'Redirect to Google OAuth authorization',
        parameters: [
          {
            name: 'redirect_uri',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'state',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
          {
            name: 'code_challenge',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
          {
            name: 'code_challenge_method',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '302': { description: 'Redirect to Google OAuth' },
          '400': {
            description: 'Missing redirect_uri or Google OAuth not enabled',
          },
          '500': { description: 'Google OAuth misconfigured' },
        },
      },
    },
    '/auth/oauth/github/authorize': {
      get: {
        tags: ['Authentication'],
        summary: 'Redirect to GitHub OAuth authorization',
        parameters: [
          {
            name: 'redirect_uri',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'state',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '302': { description: 'Redirect to GitHub OAuth' },
          '400': {
            description: 'Missing redirect_uri or GitHub OAuth not enabled',
          },
          '500': { description: 'GitHub OAuth misconfigured' },
        },
      },
    },
  },
} as const;
