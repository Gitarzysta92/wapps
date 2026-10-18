import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, NextFunction } from 'express';
import {
  CanonicalIdentityStore,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import { AuthenticatedRequest } from '../decorators/auth-user.decorator';
import { CANONICAL_IDENTITIES } from '../services/identity-state.tokens';
import {
  NOTIFICATION_WORKER_ID,
  NOTIFICATION_WORKER_ROLE,
  NOTIFICATION_WORKER_SCOPE,
} from '@domains/community';

@Injectable()
export class AuthValidationMiddleware implements NestMiddleware {
  private readonly ingressSecret = process.env['INGRESS_AUTH_SECRET'];
  private readonly notificationSecret =
    process.env['NOTIFICATION_SERVICE_SECRET'];
  constructor(
    @Inject(CANONICAL_IDENTITIES)
    private readonly identities: CanonicalIdentityStore
  ) {}

  async use(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    delete req.authUser;
    const path = (req.originalUrl || req.path).split('?')[0].replace(/\/$/, '');
    if (
      (req.method === 'GET' &&
        [
          '/api/internal/authentication/validate',
          '/api/internal/authentication/validate-optional',
          '/api/auth/methods',
          '/api/auth/email-verification/status',
          '/api/auth/oauth/google/authorize',
          '/api/auth/oauth/github/authorize',
        ].includes(path)) ||
      (req.method === 'POST' &&
        [
          '/api/auth/signin',
          '/api/auth/signin/anonymous',
          '/api/auth/signin/oauth',
          '/api/auth/register',
          '/api/auth/refresh',
          '/api/auth/signout',
          '/api/auth/password-reset/verify',
          '/api/auth/password-reset/complete',
          '/api/auth/email-verification/request',
          '/api/auth/email-verification/verify',
          '/api/auth/email-verification/complete',
        ].includes(path))
    )
      return next();
    if (
      (req.method === 'POST' && path === '/api/password-recovery') ||
      (req.method === 'GET' &&
        ['/api/health', '/health', '/api/docs', '/api/docs-json'].includes(
          path
        ))
    )
      return next();
    if (req.method === 'GET' && path.startsWith('/api/docs/')) return next();
    const header = (name: string, max = 256): string | undefined => {
      const value = req.headers[name];
      const count =
        req.rawHeaders?.filter(
          (_value, index) =>
            index % 2 === 0 && req.rawHeaders[index].toLowerCase() === name
        ).length ?? 0;
      if (
        count > 1 ||
        (value !== undefined &&
          (typeof value !== 'string' || value.length > max))
      )
        throw new BadRequestException('Invalid authentication header');
      return value;
    };
    const notificationSecret = header('x-notification-worker', 128);
    if (path === '/api/internal/mention-recipients') {
      if (
        req.method !== 'POST' ||
        !this.notificationSecret ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(this.notificationSecret) ||
        !notificationSecret ||
        Buffer.byteLength(notificationSecret) !==
          Buffer.byteLength(this.notificationSecret) ||
        !timingSafeEqual(
          Buffer.from(notificationSecret),
          Buffer.from(this.notificationSecret)
        ) ||
        [
          'authorization',
          'x-ingress-auth',
          'x-user-id',
          'x-user-claims',
          'x-user-email',
          'x-auth-time',
          'x-anonymous',
        ].some((name) => header(name, 8192) !== undefined)
      )
        throw new UnauthorizedException(
          'Invalid notification service authentication'
        );
      req.authUser = {
        userId: NOTIFICATION_WORKER_ID,
        userClaims: {
          tenantId: NOTIFICATION_WORKER_SCOPE,
          roles: [NOTIFICATION_WORKER_ROLE],
        },
        isAnonymous: false,
      };
      return next();
    }
    if (notificationSecret !== undefined)
      throw new UnauthorizedException(
        'Notification credentials are limited to service routes'
      );
    const secret = header('x-ingress-auth', 1024);
    if (
      !this.ingressSecret ||
      !secret ||
      Buffer.byteLength(secret) !== Buffer.byteLength(this.ingressSecret) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(this.ingressSecret))
    )
      throw new UnauthorizedException('Untrusted authentication headers');
    const uid = header('x-user-id', 128);
    const anonymous = header('x-anonymous');
    const publicRead =
      req.method === 'GET' &&
      /^\/api\/profiles(?:\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?:\/(?:totals|badges|activity|discussions|suites|articles|favorites|avatar\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}))?)?$/.test(
        path
      );
    if (publicRead && anonymous === 'true') {
      if (
        uid !== undefined ||
        ['authorization', 'x-user-email', 'x-user-claims', 'x-auth-time'].some(
          (name) => header(name, 8192) !== undefined
        )
      )
        throw new UnauthorizedException('Conflicting anonymous authentication');
      return next();
    }
    if (
      (anonymous !== undefined && anonymous !== 'false') ||
      !isCanonicalIdentityId(uid)
    )
      throw new UnauthorizedException('Authenticated identity required');
    const rawClaims = header('x-user-claims', 8192);
    let claims: Record<string, unknown> | undefined;
    if (rawClaims !== undefined) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawClaims);
      } catch {
        throw new BadRequestException('Invalid authentication claims');
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new BadRequestException('Invalid authentication claims');
      claims = Object.fromEntries(Object.entries(parsed));
      const roles = claims['roles'];
      if (
        roles !== undefined &&
        (!Array.isArray(roles) ||
          roles.length > 64 ||
          roles.some(
            (role) => typeof role !== 'string' || !role || role.length > 128
          ))
      )
        throw new BadRequestException('Invalid authentication roles');
    }
    const userEmail = header('x-user-email', 320);
    const authTime = header('x-auth-time', 32);
    if (authTime !== undefined && !/^\d+$/.test(authTime))
      throw new BadRequestException('Invalid authentication time');
    const state = await this.identities.find(uid).catch(() => {
      throw new ServiceUnavailableException('Identity validation unavailable');
    });
    if (
      !state ||
      state.identityId !== uid ||
      !state.isActive ||
      state.isSuspended ||
      state.isDeleted
    )
      throw new UnauthorizedException('Identity unavailable');
    req.authUser = {
      userId: uid,
      userEmail,
      authTime,
      userClaims: claims,
      isAnonymous: false,
    };
    next();
  }
}
