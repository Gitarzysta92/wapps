import express, { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import swaggerUi from 'swagger-ui-express';

const app = express();
const PORT = process.env.PORT || 8080;
const INGRESS_AUTH_SECRET = process.env.INGRESS_AUTH_SECRET;

// Initialize Firebase Admin
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
});

// Validate configuration
if (!INGRESS_AUTH_SECRET) {
  console.warn('⚠️  WARNING: INGRESS_AUTH_SECRET not set - backend services cannot validate auth headers!');
}

// Swagger documentation
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Firebase Auth Validator API',
    version: '1.0.0',
    description: 'Service for validating Firebase authentication tokens for ingress-nginx external auth',
    contact: {
      name: 'Platform Team'
    }
  },
  servers: [
    {
      url: 'http://firebase-auth-validator.default.svc.cluster.local',
      description: 'Kubernetes cluster internal'
    }
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints'
    },
    {
      name: 'Authentication',
      description: 'Firebase token validation endpoints'
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
          status: {
            type: 'string',
            example: 'healthy'
          }
        }
      },
      ValidateSuccessResponse: {
        type: 'object',
        properties: {
          authenticated: {
            type: 'boolean',
            example: true
          },
          uid: {
            type: 'string',
            example: 'abc123xyz'
          }
        }
      },
      ValidateOptionalResponse: {
        type: 'object',
        properties: {
          authenticated: {
            type: 'boolean'
          },
          uid: {
            type: 'string',
            nullable: true
          },
          anonymous: {
            type: 'boolean',
            nullable: true
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            example: 'Token validation failed'
          }
        }
      }
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication token is missing or invalid',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        },
        headers: {
          'WWW-Authenticate': {
            schema: {
              type: 'string',
              example: 'Bearer'
            }
          }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        description: 'Returns the health status of the service',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                }
              }
            }
          }
        }
      }
    },
    '/validate': {
      get: {
        tags: ['Authentication'],
        summary: 'Validate Firebase token (required)',
        description: 'Validates Firebase ID token from Authorization header. Used by ingress-nginx external auth. Returns 401 if token is missing or invalid.',
        security: [
          {
            BearerAuth: []
          }
        ],
        parameters: [
          {
            in: 'header',
            name: 'Authorization',
            required: true,
            schema: {
              type: 'string',
              example: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            description: 'Firebase ID token in Bearer format'
          }
        ],
        responses: {
          '200': {
            description: 'Token is valid',
            headers: {
              'X-User-Id': {
                schema: {
                  type: 'string'
                },
                description: 'Authenticated user ID'
              },
              'X-User-Email': {
                schema: {
                  type: 'string'
                },
                description: 'Authenticated user email'
              },
              'X-Auth-Time': {
                schema: {
                  type: 'string'
                },
                description: 'Authentication timestamp'
              },
              'X-User-Claims': {
                schema: {
                  type: 'string'
                },
                description: 'Custom claims as JSON string (if present)'
              }
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidateSuccessResponse'
                }
              }
            }
          },
          '401': {
            $ref: '#/components/responses/UnauthorizedError'
          }
        }
      }
    },
    '/validate-optional': {
      get: {
        tags: ['Authentication'],
        summary: 'Validate Firebase token (optional)',
        description: 'Validates Firebase ID token if present, otherwise allows anonymous access. Used for endpoints that support both authenticated and anonymous users.',
        security: [
          {
            BearerAuth: []
          },
          {}
        ],
        parameters: [
          {
            in: 'header',
            name: 'Authorization',
            required: false,
            schema: {
              type: 'string',
              example: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            description: 'Firebase ID token in Bearer format (optional)'
          }
        ],
        responses: {
          '200': {
            description: 'Token validated or anonymous access allowed',
            headers: {
              'X-User-Id': {
                schema: {
                  type: 'string'
                },
                description: 'Authenticated user ID (only if token provided and valid)'
              },
              'X-User-Email': {
                schema: {
                  type: 'string'
                },
                description: 'Authenticated user email (only if token provided and valid)'
              },
              'X-Anonymous': {
                schema: {
                  type: 'string',
                  enum: ['true']
                },
                description: 'Set to "true" if accessing anonymously'
              }
            },
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidateOptionalResponse'
                },
                examples: {
                  authenticated: {
                    summary: 'Authenticated user',
                    value: {
                      authenticated: true,
                      uid: 'abc123xyz'
                    }
                  },
                  anonymous: {
                    summary: 'Anonymous user',
                    value: {
                      authenticated: false,
                      anonymous: true
                    }
                  }
                }
              }
            }
          }
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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy' });
});

// Validation endpoint for ingress-nginx external auth
app.get('/validate', async (req: Request, res: Response) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.log('No Authorization header provided');
      return res.status(401).json({ error: 'No authorization header' });
    }

    // Extract Bearer token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!token || token === authHeader) {
      console.log('Invalid Authorization header format');
      return res.status(401).json({ error: 'Invalid authorization header format' });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Set headers for downstream services
    res.setHeader('X-User-Id', decodedToken.uid);
    res.setHeader('X-User-Email', decodedToken.email || '');
    res.setHeader('X-Auth-Time', decodedToken.auth_time?.toString() || '');
    
    // Add shared secret so backend can verify headers came from ingress
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    
    // Add custom claims if present
    if (decodedToken.custom_claims) {
      res.setHeader('X-User-Claims', JSON.stringify(decodedToken.custom_claims));
    }
    
    console.log(`✅ Token validated for user: ${decodedToken.uid}`);
    
    // Return 200 for successful validation
    return res.status(200).json({ 
      authenticated: true,
      uid: decodedToken.uid 
    });
    
  } catch (error: any) {
    console.error('❌ Token validation failed:', error.message);
    
    // Return appropriate error status
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    return res.status(401).json({ error: 'Token validation failed' });
  }
});

// Optional: endpoint that allows anonymous access
app.get('/validate-optional', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  // If no auth header, allow through as anonymous
  if (!authHeader) {
    res.setHeader('X-Anonymous', 'true');
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    return res.status(200).json({ authenticated: false, anonymous: true });
  }

  // If auth header present, validate it
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    res.setHeader('X-User-Id', decodedToken.uid);
    res.setHeader('X-User-Email', decodedToken.email || '');
    
    // Add shared secret
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    
    return res.status(200).json({ 
      authenticated: true,
      uid: decodedToken.uid 
    });
  } catch (error) {
    // If token is invalid, allow through as anonymous
    res.setHeader('X-Anonymous', 'true');
    if (INGRESS_AUTH_SECRET) {
      res.setHeader('X-Ingress-Auth', INGRESS_AUTH_SECRET);
    }
    return res.status(200).json({ authenticated: false, anonymous: true });
  }
});

app.listen(PORT, () => {
  console.log(`🔐 Firebase Auth Validator running on port ${PORT}`);
  console.log(`📋 Firebase Project ID: ${process.env.FIREBASE_PROJECT_ID || 'NOT SET'}`);
});

