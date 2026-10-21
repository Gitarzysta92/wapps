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
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';

export function reviewRequest<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw new BadRequestException('Invalid review request');
  }
}
export function reviewResult<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw reviewUnavailable();
  }
}
export function reviewUnavailable() {
  return new ServiceUnavailableException(
    'Could not confirm the review operation. Retry the same request.'
  );
}

@Catch()
export class PortalReviewErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (status === 429 || status === 503)
      response.setHeader('Retry-After', '2');
    response
      .status(status)
      .json({
        statusCode: status,
        message:
          error instanceof HttpException
            ? error.message
            : 'Reviews unavailable',
      });
  }
}

@Injectable()
export class PortalReviewRequest {
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
    if (!key || !/^[a-zA-Z0-9_-]{16,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    return key;
  }
  private selectors(request: Request, keys: string[]) {
    if (Object.keys(request.query).some((key) => !keys.includes(key)))
      throw new BadRequestException('Invalid review selectors');
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      (request.headers['transfer-encoding'] !== undefined ||
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0'))
    )
      throw new BadRequestException('Review reads do not accept a body');
  }
}
