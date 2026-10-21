import {
  EXPLORE_READER,
  EXPLORE_READER_ROLE,
  EXPLORE_READER_SCOPE,
} from '@domains/feed';
import {
  NOTIFICATION_WORKER_ID,
  NOTIFICATION_WORKER_ROLE,
  NOTIFICATION_WORKER_SCOPE,
} from '@domains/community';
import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { EditorialActor } from '../application/editorial.ports';
import { assertEditorialActor } from '../application/editorial-commands';
import { PROFILE_READER_ID } from '../suites/profile-suites';
import {
  ACCOUNT_ERASURE_WRITER,
  ACCOUNT_ERASURE_WRITER_ROLE,
  ACCOUNT_ERASURE_WRITER_SCOPE,
  ACCOUNT_EXPORT_READER,
  ACCOUNT_EXPORT_READER_ROLE,
  ACCOUNT_EXPORT_READER_SCOPE,
} from '@wapps/account';

export interface EditorialRequest extends Request {
  editorialActor?: EditorialActor | null;
}

@Injectable()
export class EditorialAuthMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: EditorialRequest, _response: Response, next: NextFunction) {
    request.editorialActor = null;
    const names = [
      'x-user-id',
      'x-user-email',
      'x-auth-time',
      'x-user-claims',
      'x-anonymous',
    ];
    const header = (name: string, max: number) => {
      const value = request.headers[name];
      if (
        value !== undefined &&
        (typeof value !== 'string' || value.length > max)
      )
        throw new BadRequestException('Invalid authentication header');
      if (
        request.rawHeaders.filter(
          (value, index) => index % 2 === 0 && value.toLowerCase() === name
        ).length > 1
      )
        throw new BadRequestException('Duplicate authentication header');
      return value;
    };
    const secret = this.config.get<string>('INGRESS_AUTH_SECRET');
    const exploreRoute = /^\/api\/internal\/explore\/?$/i.test(
      (request.originalUrl ?? '').split('?')[0]
    );
    if (exploreRoute || request.headers['x-explore-reader'] !== undefined) {
      const credential = header('x-explore-reader', 128),
        exploreSecret = this.config.get<string>('EXPLORE_SERVICE_SECRET');
      if (
        !exploreRoute ||
        request.method !== 'POST' ||
        !credential ||
        !exploreSecret ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(exploreSecret) ||
        [
          secret,
          this.config.get<string>('NOTIFICATION_SERVICE_SECRET'),
          this.config.get<string>('ACCOUNT_EXPORT_SOURCE_SECRET'),
          this.config.get<string>('ACCOUNT_ERASURE_SECRET'),
        ].includes(exploreSecret) ||
        [
          ...names,
          'authorization',
          'x-ingress-auth',
          'x-profile-reader',
          'x-notification-worker',
          'x-account-export-reader',
          'x-account-erasure-writer',
          'x-tenant-id',
          'x-roles',
        ].some((name) => request.headers[name] !== undefined) ||
        Buffer.byteLength(credential) !== Buffer.byteLength(exploreSecret) ||
        !timingSafeEqual(Buffer.from(credential), Buffer.from(exploreSecret))
      )
        throw new UnauthorizedException(
          'Explore service authentication required'
        );
      request.editorialActor = {
        identityId: EXPLORE_READER,
        tenantId: EXPLORE_READER_SCOPE,
        roles: [EXPLORE_READER_ROLE],
      };
      return next();
    }
    const notificationRoute = /^\/api\/internal\/favorite-updates\/?$/i.test(
      request.originalUrl.split('?')[0]
    );
    if (
      notificationRoute ||
      request.headers['x-notification-worker'] !== undefined
    ) {
      const credential = header('x-notification-worker', 128),
        notificationSecret = this.config.get<string>(
          'NOTIFICATION_SERVICE_SECRET'
        );
      if (
        !notificationRoute ||
        request.method !== 'POST' ||
        !credential ||
        !notificationSecret ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(notificationSecret) ||
        [
          secret,
          this.config.get<string>('ACCOUNT_EXPORT_SOURCE_SECRET'),
          this.config.get<string>('ACCOUNT_ERASURE_SECRET'),
        ].includes(notificationSecret) ||
        [
          ...names,
          'authorization',
          'x-ingress-auth',
          'x-profile-reader',
          'x-account-export-reader',
          'x-account-erasure-writer',
          'x-tenant-id',
          'x-roles',
        ].some((name) => request.headers[name] !== undefined) ||
        Buffer.byteLength(credential) !==
          Buffer.byteLength(notificationSecret) ||
        !timingSafeEqual(
          Buffer.from(credential),
          Buffer.from(notificationSecret)
        )
      )
        throw new UnauthorizedException(
          'Notification service authentication required'
        );
      request.editorialActor = {
        identityId: NOTIFICATION_WORKER_ID,
        tenantId: NOTIFICATION_WORKER_SCOPE,
        roles: [NOTIFICATION_WORKER_ROLE],
      };
      return next();
    }
    const erasureRoute = /^\/api\/internal\/account-erasure\/?$/i.test(
      request.originalUrl.split('?')[0]
    );
    if (
      erasureRoute ||
      request.headers['x-account-erasure-writer'] !== undefined
    ) {
      const credential = header('x-account-erasure-writer', 128);
      const erasureSecret = this.config.get<string>('ACCOUNT_ERASURE_SECRET');
      if (
        !erasureRoute ||
        request.method !== 'POST' ||
        [
          ...names,
          'authorization',
          'x-ingress-auth',
          'x-profile-reader',
          'x-account-export-reader',
          'x-tenant-id',
          'x-roles',
        ].some((name) => request.headers[name] !== undefined) ||
        !credential ||
        !erasureSecret ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(erasureSecret) ||
        erasureSecret === secret ||
        erasureSecret ===
          this.config.get<string>('ACCOUNT_EXPORT_SOURCE_SECRET') ||
        Buffer.byteLength(credential) !== Buffer.byteLength(erasureSecret) ||
        !timingSafeEqual(Buffer.from(credential), Buffer.from(erasureSecret))
      )
        throw new UnauthorizedException(
          'Account erasure service authentication required'
        );
      request.editorialActor = {
        identityId: ACCOUNT_ERASURE_WRITER,
        tenantId: ACCOUNT_ERASURE_WRITER_SCOPE,
        roles: [ACCOUNT_ERASURE_WRITER_ROLE],
      };
      return next();
    }
    const exportRoute = /^\/api\/internal\/account-export\/?$/i.test(
      request.originalUrl.split('?')[0]
    );
    if (
      exportRoute ||
      request.headers['x-account-export-reader'] !== undefined
    ) {
      const credential = header('x-account-export-reader', 128);
      const exportSecret = this.config.get<string>(
        'ACCOUNT_EXPORT_SOURCE_SECRET'
      );
      if (
        !exportRoute ||
        request.method !== 'POST' ||
        [
          ...names,
          'authorization',
          'x-ingress-auth',
          'x-profile-reader',
          'x-tenant-id',
          'x-roles',
        ].some((name) => request.headers[name] !== undefined) ||
        !credential ||
        !exportSecret ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(exportSecret) ||
        exportSecret === secret ||
        Buffer.byteLength(credential) !== Buffer.byteLength(exportSecret) ||
        !timingSafeEqual(Buffer.from(credential), Buffer.from(exportSecret))
      )
        throw new UnauthorizedException(
          'Account export service authentication required'
        );
      request.editorialActor = {
        identityId: ACCOUNT_EXPORT_READER,
        tenantId: ACCOUNT_EXPORT_READER_SCOPE,
        roles: [ACCOUNT_EXPORT_READER_ROLE],
      };
      return next();
    }
    const profileRoute =
      /^\/api\/internal\/profile-(suites|articles|activity|totals)\/?$/i.test(
        request.originalUrl.split('?')[0]
      );
    if (profileRoute || request.headers['x-profile-reader'] !== undefined) {
      const credential = header('x-profile-reader', 1024);
      if (
        !profileRoute ||
        request.method !== 'POST' ||
        names.some((name) => request.headers[name] !== undefined) ||
        request.headers.authorization !== undefined ||
        request.headers['x-ingress-auth'] !== undefined ||
        !secret ||
        !credential ||
        Buffer.byteLength(secret) !== Buffer.byteLength(credential) ||
        !timingSafeEqual(Buffer.from(secret), Buffer.from(credential))
      )
        throw new UnauthorizedException(
          'Profile service authentication required'
        );
      request.editorialActor = {
        identityId: PROFILE_READER_ID,
        tenantId:
          this.config.get<string>('EDITORIAL_PUBLIC_TENANT') ?? 'default',
        roles: ['editorial:profile-reader'],
      };
      return next();
    }
    if (!names.some((name) => request.headers[name] !== undefined))
      return next();
    const supplied = header('x-ingress-auth', 1024);
    if (
      !secret ||
      !supplied ||
      Buffer.byteLength(secret) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(supplied))
    )
      throw new UnauthorizedException('Untrusted authentication headers');
    const id = header('x-user-id', 128);
    const anonymous = header('x-anonymous', 5);
    if (
      anonymous !== undefined &&
      anonymous !== 'true' &&
      anonymous !== 'false'
    )
      throw new BadRequestException('Invalid anonymous flag');
    if (id && anonymous === 'true')
      throw new BadRequestException('Conflicting authentication headers');
    if (!id) {
      if (anonymous !== 'true')
        throw new UnauthorizedException('Missing authenticated identity');
      return next();
    }
    const rawClaims = header('x-user-claims', 8192);
    let claims: Record<string, unknown> = {};
    if (rawClaims) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawClaims);
      } catch {
        throw new BadRequestException('Invalid authentication claims');
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new BadRequestException('Invalid authentication claims');
      claims = Object.fromEntries(Object.entries(parsed));
    }
    const tenantId =
      claims.tenantId ??
      this.config.get<string>('EDITORIAL_PUBLIC_TENANT') ??
      'default';
    const roles = claims.roles ?? [];
    if (
      typeof tenantId !== 'string' ||
      !Array.isArray(roles) ||
      !roles.every((role): role is string => typeof role === 'string')
    )
      throw new BadRequestException('Invalid actor scope');
    const actor = { identityId: id, tenantId, roles };
    try {
      assertEditorialActor(actor);
    } catch {
      throw new BadRequestException('Invalid actor scope');
    }
    request.editorialActor = actor;
    next();
  }
}

@Injectable()
export class EditorialMutationGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<EditorialRequest>();
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      !request.editorialActor
    )
      throw new UnauthorizedException('Authentication required');
    return true;
  }
}

export const EditorialUser = createParamDecorator(
  (optional: boolean | undefined, context: ExecutionContext) => {
    const actor =
      context.switchToHttp().getRequest<EditorialRequest>().editorialActor ??
      null;
    if (!optional && !actor)
      throw new UnauthorizedException('Authentication required');
    return actor;
  }
);
