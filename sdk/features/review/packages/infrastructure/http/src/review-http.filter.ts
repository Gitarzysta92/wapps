import {
  ArgumentsHost,
  Catch,
  HttpException,
  Inject,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ReviewConflictError,
  ReviewDeniedError,
  ReviewInputError,
  ReviewMissingError,
} from '@sdk/features/review/core';
import {
  REVIEW_HTTP_OPTIONS,
  type ReviewHttpOptions,
} from './review-http.options';

@Catch()
export class ReviewHttpFilter implements ExceptionFilter {
  constructor(
    @Inject(REVIEW_HTTP_OPTIONS) private readonly options: ReviewHttpOptions
  ) {}

  catch(failure: unknown, host: ArgumentsHost) {
    const error = this.options.error ? this.options.error(failure) : failure;
    const status =
      error instanceof HttpException && error.getStatus() < 500
        ? error.getStatus()
        : error instanceof ReviewInputError
        ? 400
        : error instanceof ReviewDeniedError
        ? 403
        : error instanceof ReviewMissingError
        ? 404
        : error instanceof ReviewConflictError
        ? 409
        : 503;
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    if (status === 503) response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        status !== 503 && error instanceof Error
          ? error.message
          : 'Reviews are unavailable. Try again.',
    });
  }
}
