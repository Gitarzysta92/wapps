import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { releaseObject } from '@domains/catalog/versioning';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';

export function releaseRequest<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw new BadRequestException('Invalid release request');
  }
}
export function releaseResult<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw releaseUnavailable();
  }
}
export function releaseUnavailable() {
  return new ServiceUnavailableException(
    'Could not confirm the release operation. Retry the same request.'
  );
}
export function releasePage(value: unknown): number {
  if (value === undefined) return 1;
  if (
    typeof value !== 'string' ||
    !/^[1-9][0-9]{0,4}$/.test(value) ||
    Number(value) > 10000
  )
    throw new Error('Invalid release page');
  return Number(value);
}
export function releaseSlug(value: string): string {
  if (value.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    throw new Error('Invalid application slug');
  return value;
}

@Catch()
export class PortalReleaseErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (status === 429 || status === 503)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException ? error.message : 'Releases unavailable',
    });
  }
}

@Injectable()
export class PortalReleaseRequest {
  constructor(private readonly identities: TrustedPortalIdentityReader) {}
  actor(request: Request, keys: string[] = []) {
    const actor = this.identities.read(request);
    this.selectors(request, keys);
    return actor;
  }
  viewer(request: Request, keys: string[] = []) {
    const actor = this.identities.readOptional(request);
    this.selectors(request, keys);
    return actor;
  }
  key(request: Request) {
    const key = singleHeader(request, 'idempotency-key', 128);
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    return key;
  }
  private selectors(request: Request, keys: string[]) {
    releaseRequest(() => releaseObject(request.query, keys));
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      (request.headers['transfer-encoding'] !== undefined ||
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0'))
    )
      throw new BadRequestException('Release reads do not accept a body');
  }
}
