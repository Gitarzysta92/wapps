import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CanonicalIdentityAccessDenied,
  CanonicalIdentityConflict,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';
import { CredentialInputError } from '@sdk/features/identity/libs/management';
import { PublicProfileNotFound } from '@wapps/account';

@Catch()
export class AccountErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      response.status(error.getStatus()).json(error.getResponse());
      return;
    }
    const status =
      error instanceof PublicProfileNotFound
        ? 404
        : error instanceof CanonicalIdentityAccessDenied
        ? 403
        : error instanceof CanonicalIdentityConflict
        ? 409
        : error instanceof CanonicalIdentityInputError ||
          error instanceof CredentialInputError
        ? 400
        : 503;
    response.status(status).json({
      statusCode: status,
      message:
        status === 503
          ? 'Account service unavailable'
          : error instanceof Error
          ? error.message
          : 'Invalid request',
    });
  }
}
