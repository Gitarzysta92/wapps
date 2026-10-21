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
import { commentObject } from '@domains/community';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';

export function discussionRequest<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw new BadRequestException('Invalid discussion request');
  }
}
export function discussionResult<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw discussionUnavailable();
  }
}
export function discussionUnavailable() {
  return new ServiceUnavailableException(
    'Could not confirm the discussion operation. Retry the same request.'
  );
}

@Catch()
export class PortalDiscussionErrorFilter implements ExceptionFilter {
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
        error instanceof HttpException
          ? error.message
          : 'Discussions unavailable',
    });
  }
}

@Injectable()
export class PortalDiscussionRequest {
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
    discussionRequest(() => commentObject(request.query, keys));
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      (request.headers['transfer-encoding'] !== undefined ||
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0'))
    )
      throw new BadRequestException('Discussion reads do not accept a body');
  }
}
