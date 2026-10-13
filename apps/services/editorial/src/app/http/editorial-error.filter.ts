import {
  HealthInputError,
  HealthConflictError,
  HealthNotFoundError,
  HealthUnavailableError,
} from '@domains/reliability';
import { ExploreInputError, ExploreUnavailableError } from '@domains/feed';
import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';
import {
  ArticleInputError,
  ArticleConflictError,
  ArticleNotFoundError,
  ArticleUnavailableError,
} from '@domains/publication/article';
import {
  ReleaseInputError,
  ReleaseConflictError,
  ReleaseNotFoundError,
  ReleaseUnavailableError,
} from '@domains/catalog/versioning';
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  CatalogInputError,
  CatalogUnavailableError,
  ApplicationDraftInputError,
  ApplicationDraftConflictError,
  ApplicationDraftNotFoundError,
  ApplicationDraftUnavailableError,
} from '@domains/catalog/record';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import {
  ApplicationImageInputError,
  ApplicationImageConflictError,
  ApplicationImageNotFoundError,
  ApplicationImageRateLimitError,
  ApplicationImageUnavailableError,
} from '@domains/catalog/media';
import {
  OwnershipInputError,
  OwnershipConflictError,
  OwnershipNotFoundError,
  OwnershipRateLimitError,
  OwnershipUnavailableError,
} from '@domains/catalog/ownership';
import {
  SuiteInputError,
  SuiteConflictError,
  SuiteNotFoundError,
  SuiteUnavailableError,
} from '@domains/publication/suite';
import {
  EditorialConflictError,
  EditorialNotFoundError,
  EditorialUnavailableError,
  EditorialValidationError,
} from '../application/editorial.ports';

@Catch(
  HealthInputError,
  HealthConflictError,
  HealthNotFoundError,
  HealthUnavailableError,
  ExploreInputError,
  ExploreUnavailableError,
  CanonicalIdentityAccessDenied,
  ArticleInputError,
  ArticleConflictError,
  ArticleNotFoundError,
  ArticleUnavailableError,
  ReleaseInputError,
  ReleaseConflictError,
  ReleaseNotFoundError,
  ReleaseUnavailableError,
  ApplicationImageInputError,
  ApplicationImageConflictError,
  ApplicationImageNotFoundError,
  ApplicationImageRateLimitError,
  ApplicationImageUnavailableError,
  OwnershipInputError,
  OwnershipConflictError,
  OwnershipNotFoundError,
  OwnershipRateLimitError,
  OwnershipUnavailableError,
  ApplicationDraftInputError,
  ApplicationDraftConflictError,
  ApplicationDraftNotFoundError,
  ApplicationDraftUnavailableError,
  SuiteInputError,
  SuiteConflictError,
  SuiteNotFoundError,
  SuiteUnavailableError,
  CatalogInputError,
  CatalogUnavailableError,
  PermissionDeniedError,
  EditorialConflictError,
  EditorialNotFoundError,
  EditorialUnavailableError,
  EditorialValidationError
)
export class EditorialErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    const status =
      error instanceof PermissionDeniedError ||
      error instanceof CanonicalIdentityAccessDenied
        ? 403
        : error instanceof OwnershipRateLimitError ||
          error instanceof ApplicationImageRateLimitError
        ? 429
        : error instanceof HealthConflictError ||
          error instanceof EditorialConflictError ||
          error instanceof ApplicationImageConflictError ||
          error instanceof OwnershipConflictError ||
          error instanceof ApplicationDraftConflictError ||
          error instanceof ArticleConflictError ||
          error instanceof ReleaseConflictError ||
          error instanceof SuiteConflictError
        ? 409
        : error instanceof HealthNotFoundError ||
          error instanceof EditorialNotFoundError ||
          error instanceof ApplicationImageNotFoundError ||
          error instanceof OwnershipNotFoundError ||
          error instanceof ApplicationDraftNotFoundError ||
          error instanceof ArticleNotFoundError ||
          error instanceof ReleaseNotFoundError ||
          error instanceof SuiteNotFoundError
        ? 404
        : error instanceof HealthInputError ||
          error instanceof ExploreInputError ||
          error instanceof EditorialValidationError ||
          error instanceof ApplicationImageInputError ||
          error instanceof OwnershipInputError ||
          error instanceof ApplicationDraftInputError ||
          error instanceof CatalogInputError ||
          error instanceof ArticleInputError ||
          error instanceof ReleaseInputError ||
          error instanceof SuiteInputError
        ? 400
        : 503;
    const response = host.switchToHttp().getResponse<Response>();
    if (
      error instanceof HealthUnavailableError ||
      error instanceof ExploreUnavailableError ||
      error instanceof CatalogUnavailableError ||
      error instanceof ApplicationImageUnavailableError ||
      error instanceof ApplicationDraftUnavailableError ||
      error instanceof OwnershipUnavailableError ||
      error instanceof ArticleUnavailableError ||
      error instanceof ReleaseUnavailableError ||
      error instanceof SuiteUnavailableError
    )
      response.setHeader('Retry-After', '2');
    if (
      error instanceof OwnershipRateLimitError ||
      error instanceof ApplicationImageRateLimitError
    )
      response.setHeader('Retry-After', '30');
    response.setHeader('Cache-Control', 'no-store');
    response
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
