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
import { applicationDraftObject } from '@domains/catalog/record';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';

export function applicationRequest<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw new BadRequestException('Invalid application workspace request');
  }
}
export function applicationResult<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw applicationUnavailable();
  }
}
export function applicationUnavailable() {
  return new ServiceUnavailableException(
    'Could not confirm the application operation. Retry the same request.'
  );
}

@Catch()
export class PortalApplicationErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    // Early upload rejection must not leave an unread body on a reusable connection.
    if (!request.complete) response.setHeader('Connection', 'close');
    if (status === 429 || status === 503)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException
          ? error.message
          : 'Application workspace unavailable',
    });
  }
}

@Injectable()
export class PortalApplicationRequest {
  constructor(private readonly identities: TrustedPortalIdentityReader) {}
  actor(request: Request, query: string[] = []) {
    const actor = this.identities.read(request);
    this.selectors(request, query);
    return actor;
  }
  viewer(request: Request) {
    const actor = this.identities.readOptional(request);
    this.selectors(request, []);
    return actor;
  }
  key(request: Request) {
    const key = singleHeader(request, 'idempotency-key', 128);
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    return key;
  }
  private selectors(request: Request, keys: string[]) {
    applicationRequest(() => applicationDraftObject(request.query, keys));
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      (request.headers['transfer-encoding'] !== undefined ||
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0'))
    )
      throw new BadRequestException('Workspace reads do not accept a body');
  }
}
