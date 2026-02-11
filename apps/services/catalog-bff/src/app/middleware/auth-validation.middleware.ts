import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate that authentication headers come from a trusted source (ingress-nginx).
 * 
 * Security model:
 * 1. Client → ingress-nginx (with Authorization: Bearer <firebase-token>)
 * 2. ingress-nginx → authenticator (validates token)
 * 3. authenticator → ingress-nginx (returns X-User-Id, etc.)
 * 4. ingress-nginx → backend service (forwards headers + X-Ingress-Auth secret)
 * 5. backend service validates X-Ingress-Auth to trust other headers
 * 
 * Without this validation, anyone with cluster access could spoof X-User-Id headers.
 */
@Injectable()
export class AuthValidationMiddleware implements NestMiddleware {
  private readonly ingressSecret = process.env.INGRESS_AUTH_SECRET;

  use(req: Request, res: Response, next: NextFunction) {
    const userId = req.headers['x-user-id'] as string;
    const anonymous = req.headers['x-anonymous'] as string;
    const ingressAuth = req.headers['x-ingress-auth'] as string;

    // If no user headers present, allow through (public endpoint)
    if (!userId && !anonymous) {
      return next();
    }

    // If authentication headers are present, validate they came from ingress
    if (userId || anonymous) {
      // Verify the request came through ingress-nginx with the shared secret
      if (!this.ingressSecret) {
        throw new UnauthorizedException(
          'Server misconfiguration: INGRESS_AUTH_SECRET not set'
        );
      }

      if (ingressAuth !== this.ingressSecret) {
        throw new UnauthorizedException(
          'Invalid authentication headers: request did not originate from trusted ingress'
        );
      }

      // Headers are validated - attach user info to request for easy access
      if (userId) {
        (req as any).userId = userId;
        (req as any).userEmail = req.headers['x-user-email'] as string;
        (req as any).authTime = req.headers['x-auth-time'] as string;
        (req as any).userClaims = req.headers['x-user-claims'] 
          ? JSON.parse(req.headers['x-user-claims'] as string)
          : undefined;
      }
      
      if (anonymous === 'true') {
        (req as any).isAnonymous = true;
      }
    }

    next();
  }
}

