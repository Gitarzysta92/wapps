import {
  ArgumentsHost,
  Catch,
  HttpException,
  Inject,
  type ExceptionFilter,
} from '@nestjs/common';
import { DiscussionKeyError } from '@sdk/features/discussion/core';
import {
  DiscussionConflictError,
  DiscussionNotFoundError,
  DiscussionProjectionPendingError,
  DiscussionValidationError,
} from '@sdk/features/discussion/libs/management';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import type { Response } from 'express';
import {
  DISCUSSION_HTTP_OPTIONS,
  type DiscussionHttpOptions,
} from './discussion-http.options';

@Catch()
export class DiscussionHttpFilter implements ExceptionFilter {
  constructor(
    @Inject(DISCUSSION_HTTP_OPTIONS)
    private readonly options: DiscussionHttpOptions
  ) {}

  catch(failure: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    const error = this.options.error ? this.options.error(failure) : failure;
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    const status =
      error instanceof PermissionDeniedError
        ? 403
        : error instanceof DiscussionConflictError
        ? 409
        : error instanceof DiscussionNotFoundError
        ? 404
        : error instanceof DiscussionValidationError ||
          error instanceof DiscussionKeyError
        ? 400
        : 503;
    if (status === 503) response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        status !== 503 && error instanceof Error
          ? error.message
          : error instanceof DiscussionProjectionPendingError
          ? 'Discussion projection is pending'
          : 'Discussion dependency unavailable',
    });
  }
}
