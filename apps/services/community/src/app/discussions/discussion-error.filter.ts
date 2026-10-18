import { ExploreInputError } from '@domains/feed';
import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import { PublicCommentInputError } from '@domains/community';
import {
  DiscussionConflictError,
  DiscussionNotFoundError,
  DiscussionValidationError,
} from './application/discussion-write.port';
import { DiscussionProjectionPendingError } from './application/discussion-queries';

@Catch()
export class DiscussionErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    const status =
      error instanceof PermissionDeniedError ||
      error instanceof CanonicalIdentityAccessDenied
        ? 403
        : error instanceof DiscussionConflictError
        ? 409
        : error instanceof DiscussionNotFoundError
        ? 404
        : error instanceof ExploreInputError ||
          error instanceof DiscussionValidationError ||
          error instanceof PublicCommentInputError
        ? 400
        : 503;
    if (status === 503) response.setHeader('Retry-After', '2');
    const message =
      status !== 503 && error instanceof Error
        ? error.message
        : error instanceof DiscussionProjectionPendingError
        ? 'Discussion projection is pending'
        : 'Discussion dependency unavailable';
    response.status(status).json({ statusCode: status, message });
  }
}
