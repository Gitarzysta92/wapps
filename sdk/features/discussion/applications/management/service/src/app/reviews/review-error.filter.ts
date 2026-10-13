import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ReviewConflictError,
  ReviewDeniedError,
  ReviewInputError,
  ReviewMissingError,
} from '@sdk/features/review/core';

@Catch()
export class ReviewErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const status =
      error instanceof HttpException && error.getStatus() < 500
        ? error.getStatus()
        : error instanceof ReviewInputError
        ? 400
        : error instanceof ReviewDeniedError ||
          error instanceof CanonicalIdentityAccessDenied
        ? 403
        : error instanceof ReviewMissingError
        ? 404
        : error instanceof ReviewConflictError
        ? 409
        : 503;
    host
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Cache-Control', 'no-store');
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        message:
          status === 503
            ? 'Reviews are unavailable. Try again.'
            : (error as Error).message,
      });
  }
}
