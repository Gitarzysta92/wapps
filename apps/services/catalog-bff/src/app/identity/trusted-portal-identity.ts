import { timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';

export interface TrustedPortalIdentity {
  identityId: string;
  headers: Record<string, string>;
}

export interface TrustedPortalViewer {
  identityId: string | null;
  headers: Record<string, string>;
}

export function singleHeader(
  request: Request,
  name: string,
  max: number
): string | undefined {
  const value = request.headers[name];
  const count = request.rawHeaders.filter(
    (entry, index) => index % 2 === 0 && entry.toLowerCase() === name
  ).length;
  if (
    count > 1 ||
    (value !== undefined && (typeof value !== 'string' || value.length > max))
  )
    throw new BadRequestException('Invalid request header');
  return value;
}

@Injectable()
export class TrustedPortalIdentityReader {
  constructor(private readonly config: ConfigService) {}

  readWithEmail(request: Request): TrustedPortalIdentity {
    const actor = this.read(request);
    const email = singleHeader(request, 'x-user-email', 320);
    if (email !== undefined) {
      if (
        !email ||
        Array.from(email).some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        )
      )
        throw new BadRequestException('Invalid authentication email');
      actor.headers['x-user-email'] = email;
    }
    return actor;
  }

  readOptional(request: Request): TrustedPortalViewer {
    if (singleHeader(request, 'x-anonymous', 5) !== 'true')
      return this.read(request);
    const configured = this.ingress(request);
    if (
      [
        'x-user-id',
        'x-user-claims',
        'x-user-email',
        'x-auth-time',
        'authorization',
      ].some((name) => singleHeader(request, name, 8192) !== undefined)
    )
      throw new UnauthorizedException('Conflicting anonymous authentication');
    return {
      identityId: null,
      headers: { 'x-ingress-auth': configured, 'x-anonymous': 'true' },
    };
  }

  private ingress(request: Request): string {
    const configured = this.config.get<string>('INGRESS_AUTH_SECRET');
    if (!configured || configured.length > 1024)
      throw new ServiceUnavailableException(
        'Portal authentication is unconfigured'
      );
    const supplied = singleHeader(request, 'x-ingress-auth', 1024);
    if (
      !supplied ||
      Buffer.byteLength(supplied) !== Buffer.byteLength(configured) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(configured))
    )
      throw new UnauthorizedException('Trusted authentication required');
    return configured;
  }

  read(request: Request): TrustedPortalIdentity {
    const configured = this.ingress(request);
    const identityId = singleHeader(request, 'x-user-id', 128);
    const anonymous = singleHeader(request, 'x-anonymous', 5);
    if (
      !isCanonicalIdentityId(identityId) ||
      (anonymous !== undefined && anonymous !== 'false')
    )
      throw new UnauthorizedException('Signed-in account required');
    const raw = singleHeader(request, 'x-user-claims', 8192);
    let claims: unknown = {};
    try {
      if (raw !== undefined) claims = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Invalid authentication claims');
    }
    if (!claims || typeof claims !== 'object' || Array.isArray(claims))
      throw new BadRequestException('Invalid authentication claims');
    const values = claims as Record<string, unknown>;
    const roles = values['roles'];
    const tenantId = values['tenantId'];
    if (
      (roles !== undefined &&
        (!Array.isArray(roles) ||
          roles.length > 64 ||
          roles.some(
            (role) => typeof role !== 'string' || !role || role.length > 128
          ))) ||
      (tenantId !== undefined && !isCanonicalIdentityId(tenantId))
    )
      throw new BadRequestException('Invalid authentication claims');
    // Account rechecks canonical lifecycle and policy. Only verified context crosses this boundary.
    return {
      identityId,
      headers: {
        'x-ingress-auth': configured,
        'x-user-id': identityId,
        'x-anonymous': 'false',
        'x-user-claims': JSON.stringify({
          ...(tenantId !== undefined ? { tenantId } : {}),
          roles: roles ?? [],
        }),
      },
    };
  }
}
