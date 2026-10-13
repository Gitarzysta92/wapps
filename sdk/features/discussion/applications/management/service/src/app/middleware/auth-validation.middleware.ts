import { EXPLORE_READER, EXPLORE_READER_ROLE, EXPLORE_READER_SCOPE } from '@domains/feed';
import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Response, NextFunction } from 'express';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { DISCUSSION_PROFILE_READER } from '../discussions/application/profile-discussions';
import {
  NOTIFICATION_WORKER_ID,
  NOTIFICATION_WORKER_ROLE,
  NOTIFICATION_WORKER_SCOPE,
} from '@sdk/features/discussion/core';
import {
  ACCOUNT_ERASURE_WRITER,
  ACCOUNT_ERASURE_WRITER_ROLE,
  ACCOUNT_ERASURE_WRITER_SCOPE,
  ACCOUNT_EXPORT_READER,
  ACCOUNT_EXPORT_READER_ROLE,
  ACCOUNT_EXPORT_READER_SCOPE,
} from '@sdk/features/identity/libs/management';

/**
 * Validates that authentication headers come from a trusted source (ingress-nginx).
 * Mirrors the pattern used in `apps/services/catalog-bff`.
 */
@Injectable()
export class AuthValidationMiddleware implements NestMiddleware {
  private readonly ingressSecret = process.env.INGRESS_AUTH_SECRET;
  private readonly exportSecret = process.env.ACCOUNT_EXPORT_SOURCE_SECRET;

  use(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
    req.authUser = { isAnonymous: true };
    const names = [
      'x-user-id',
      'x-anonymous',
      'x-user-email',
      'x-auth-time',
      'x-user-claims',
    ];
    const header = (name: string, max = 256) => {
      const value = req.headers[name];
      if (
        value !== undefined &&
        (typeof value !== 'string' || value.length > max)
      )
        throw new BadRequestException('Invalid authentication header');
      if (
        (req.rawHeaders ?? []).filter(
          (value, index) => index % 2 === 0 && value.toLowerCase() === name
        ).length > 1
      )
        throw new BadRequestException('Duplicate authentication header');
      return value;
    };
    const exploreRoute = /^\/api\/internal\/explore\/?$/i.test((req.originalUrl ?? '').split('?')[0]);
    if (exploreRoute || req.headers['x-explore-reader'] !== undefined) {
      const credential = header('x-explore-reader', 128), exploreSecret = process.env.EXPLORE_SERVICE_SECRET;
      if (!exploreRoute || req.method !== 'POST' || !credential || !exploreSecret ||
          !/^[A-Za-z0-9_-]{32,128}$/.test(exploreSecret) ||
          [this.ingressSecret, process.env.NOTIFICATION_SERVICE_SECRET, process.env.ACCOUNT_EXPORT_SOURCE_SECRET, process.env.ACCOUNT_ERASURE_SECRET].includes(exploreSecret) ||
          [...names, 'authorization', 'x-ingress-auth', 'x-profile-reader', 'x-notification-worker', 'x-account-export-reader', 'x-account-erasure-writer', 'x-tenant-id', 'x-roles'].some(name => req.headers[name] !== undefined) ||
          Buffer.byteLength(credential) !== Buffer.byteLength(exploreSecret) || !timingSafeEqual(Buffer.from(credential), Buffer.from(exploreSecret)))
        throw new UnauthorizedException('Explore service authentication required');
      req.authUser = { userId: EXPLORE_READER, isAnonymous: false, userClaims: { tenantId: EXPLORE_READER_SCOPE, roles: [EXPLORE_READER_ROLE] } };
      return next();
    }
    const notificationRoute =
      /^\/api\/internal\/(reply-notifications|mention-notifications|favorite-updates)\/?$/i.test(
        (req.originalUrl ?? '').split('?')[0]
      );
    if (
      notificationRoute ||
      req.headers['x-notification-worker'] !== undefined
    ) {
      const credential = header('x-notification-worker', 128);
      const secret = process.env.NOTIFICATION_SERVICE_SECRET;
      if (
        !notificationRoute ||
        req.method !== 'POST' ||
        !credential ||
        !secret ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(secret) ||
        [
          this.ingressSecret,
          this.exportSecret,
          process.env.ACCOUNT_ERASURE_SECRET,
        ].includes(secret) ||
        [
          ...names,
          'authorization',
          'x-ingress-auth',
          'x-profile-reader',
          'x-account-export-reader',
          'x-account-erasure-writer',
          'x-tenant-id',
          'x-roles',
        ].some((name) => req.headers[name] !== undefined) ||
        Buffer.byteLength(credential) !== Buffer.byteLength(secret) ||
        !timingSafeEqual(Buffer.from(credential), Buffer.from(secret))
      )
        throw new UnauthorizedException(
          'Notification service authentication required'
        );
      req.authUser = {
        userId: NOTIFICATION_WORKER_ID,
        isAnonymous: false,
        userClaims: {
          tenantId: NOTIFICATION_WORKER_SCOPE,
          roles: [NOTIFICATION_WORKER_ROLE],
        },
      };
      return next();
    }
    const erasureRoute = /^\/api\/internal\/account-erasure\/?$/i.test(
      (req.originalUrl ?? '').split('?')[0]
    );
    if (erasureRoute || req.headers['x-account-erasure-writer'] !== undefined) {
      const credential = header('x-account-erasure-writer', 128),
        erasureSecret = process.env.ACCOUNT_ERASURE_SECRET;
      if (
        !erasureRoute ||
        req.method !== 'POST' ||
        [
          ...names,
          'authorization',
          'x-ingress-auth',
          'x-profile-reader',
          'x-account-export-reader',
          'x-tenant-id',
          'x-roles',
        ].some((name) => req.headers[name] !== undefined) ||
        !credential ||
        !erasureSecret ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(erasureSecret) ||
        erasureSecret === this.ingressSecret ||
        erasureSecret === this.exportSecret ||
        Buffer.byteLength(credential) !== Buffer.byteLength(erasureSecret) ||
        !timingSafeEqual(Buffer.from(credential), Buffer.from(erasureSecret))
      )
        throw new UnauthorizedException(
          'Account erasure service authentication required'
        );
      req.authUser = {
        userId: ACCOUNT_ERASURE_WRITER,
        isAnonymous: false,
        userClaims: {
          tenantId: ACCOUNT_ERASURE_WRITER_SCOPE,
          roles: [ACCOUNT_ERASURE_WRITER_ROLE],
        },
      };
      return next();
    }
    const exportRoute = /^\/api\/internal\/account-export\/?$/i.test(
      (req.originalUrl ?? '').split('?')[0]
    );
    if (exportRoute || req.headers['x-account-export-reader'] !== undefined) {
      const credential = header('x-account-export-reader', 128);
      if (
        !exportRoute ||
        req.method !== 'POST' ||
        [
          ...names,
          'authorization',
          'x-ingress-auth',
          'x-profile-reader',
          'x-tenant-id',
          'x-roles',
        ].some((name) => req.headers[name] !== undefined) ||
        !credential ||
        !this.exportSecret ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(this.exportSecret) ||
        this.exportSecret === this.ingressSecret ||
        Buffer.byteLength(credential) !==
          Buffer.byteLength(this.exportSecret) ||
        !timingSafeEqual(
          Buffer.from(credential),
          Buffer.from(this.exportSecret)
        )
      )
        throw new UnauthorizedException(
          'Account export service authentication required'
        );
      req.authUser = {
        userId: ACCOUNT_EXPORT_READER,
        isAnonymous: false,
        userClaims: {
          tenantId: ACCOUNT_EXPORT_READER_SCOPE,
          roles: [ACCOUNT_EXPORT_READER_ROLE],
        },
      };
      return next();
    }
    const profileRoute =
      /^\/api\/internal\/profile-(discussions|activity|totals)\/?$/i.test(
        (req.originalUrl ?? '').split('?')[0]
      );
    if (profileRoute || req.headers['x-profile-reader'] !== undefined) {
      const credential = header('x-profile-reader', 1024);
      if (
        !profileRoute ||
        req.method !== 'POST' ||
        names.some((name) => req.headers[name] !== undefined) ||
        req.headers.authorization !== undefined ||
        req.headers['x-ingress-auth'] !== undefined ||
        !credential ||
        !this.ingressSecret ||
        Buffer.byteLength(credential) !==
          Buffer.byteLength(this.ingressSecret) ||
        !timingSafeEqual(
          Buffer.from(credential),
          Buffer.from(this.ingressSecret)
        )
      )
        throw new UnauthorizedException(
          'Profile service authentication required'
        );
      req.authUser = {
        userId: DISCUSSION_PROFILE_READER,
        isAnonymous: false,
        userClaims: {
          tenantId: process.env.DISCUSSION_PUBLIC_TENANT ?? 'default',
          roles: ['discussion:profile-reader'],
        },
      };
      return next();
    }
    if (!names.some((name) => req.headers[name] !== undefined)) return next();
    const ingressAuth = header('x-ingress-auth', 1024);
    if (
      !this.ingressSecret ||
      !ingressAuth ||
      Buffer.byteLength(ingressAuth) !==
        Buffer.byteLength(this.ingressSecret) ||
      !timingSafeEqual(
        Buffer.from(ingressAuth),
        Buffer.from(this.ingressSecret)
      )
    )
      throw new UnauthorizedException('Untrusted authentication headers');
    const userId = header('x-user-id', 128);
    const anonymous = header('x-anonymous');
    if (
      anonymous !== undefined &&
      anonymous !== 'true' &&
      anonymous !== 'false'
    )
      throw new BadRequestException('Invalid anonymous flag');
    if (userId && anonymous === 'true')
      throw new BadRequestException('Conflicting authentication headers');
    const rawClaims = header('x-user-claims', 8192);
    let userClaims: Record<string, unknown> | undefined;
    if (rawClaims) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawClaims);
      } catch {
        throw new BadRequestException('Invalid authentication claims');
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw new BadRequestException('Invalid authentication claims');
      userClaims = Object.fromEntries(Object.entries(parsed));
    }
    if (!userId && anonymous !== 'true')
      throw new UnauthorizedException('Missing authenticated identity');
    const user: AuthenticatedUser = {
      userId,
      userEmail: header('x-user-email'),
      authTime: header('x-auth-time'),
      userClaims,
      isAnonymous: !userId,
    };
    req.authUser = user;
    next();
  }
}
