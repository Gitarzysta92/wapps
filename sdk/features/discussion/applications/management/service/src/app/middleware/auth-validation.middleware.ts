import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Validates that authentication headers come from a trusted source (ingress-nginx).
 * Mirrors the pattern used in `apps/services/catalog-bff`.
 */
@Injectable()
export class AuthValidationMiddleware implements NestMiddleware {
  private readonly ingressSecret = process.env.INGRESS_AUTH_SECRET;

  use(req: Request, _res: Response, next: NextFunction) {
    const userId = req.headers['x-user-id'] as string;
    const anonymous = req.headers['x-anonymous'] as string;
    const ingressAuth = req.headers['x-ingress-auth'] as string;

    // If no user headers present, allow through (public endpoint)
    if (!userId && !anonymous) {
      return next();
    }

    // If authentication headers are present, validate they came from ingress
    if (userId || anonymous) {
      if (!this.ingressSecret) {
        throw new UnauthorizedException('Server misconfiguration: INGRESS_AUTH_SECRET not set');
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

