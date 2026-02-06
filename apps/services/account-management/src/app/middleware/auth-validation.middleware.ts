import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Validates that authentication headers come from a trusted source (ingress-nginx).
 * Mirrors `apps/services/discussion` / `apps/services/catalog-bff`.
 */
@Injectable()
export class AuthValidationMiddleware implements NestMiddleware {
  private readonly ingressSecret = process.env.INGRESS_AUTH_SECRET;

  use(req: Request, _res: Response, next: NextFunction) {
    const userId = req.headers['x-user-id'] as string;
    const anonymous = req.headers['x-anonymous'] as string;
    const ingressAuth = req.headers['x-ingress-auth'] as string;

    // For admin service, require authentication headers on all routes except health/docs.
    // NOTE: `req.path` alone can be just "/" when middleware is mounted on a specific route.
    // Use the original URL (or baseUrl+path) so health checks remain public.
    const urlPathRaw = (req.originalUrl || `${req.baseUrl || ''}${req.path || ''}`).split('?')[0] || '';
    const urlPath = urlPathRaw.length > 1 ? urlPathRaw.replace(/\/$/, '') : urlPathRaw;
    const isPublic =
      urlPath === '/api/health' ||
      urlPath === '/health' ||
      urlPath === '/api/docs' ||
      urlPath.startsWith('/api/docs/') ||
      urlPath.startsWith('/api-docs') ||
      urlPath.startsWith('/api-docs.json');

    if (isPublic) {
      return next();
    }

    if (!userId && !anonymous) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!this.ingressSecret) {
      throw new UnauthorizedException('Server misconfiguration: INGRESS_AUTH_SECRET not set');
    }

    if (ingressAuth !== this.ingressSecret) {
      throw new UnauthorizedException(
        'Invalid authentication headers: request did not originate from trusted ingress'
      );
    }

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

    next();
  }
}

