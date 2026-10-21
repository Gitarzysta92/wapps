import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Header,
  Param,
  Query,
  UseFilters,
} from '@nestjs/common';
import type { Response } from 'express';
import { CatalogInputError } from '@domains/catalog/record';
import {
  HealthInputError,
  HealthNotFoundError,
  HealthUnavailableError,
} from '@domains/reliability';
import { ApplicationHealthClient } from './application-health.client';

@Catch(
  CatalogInputError,
  HealthInputError,
  HealthNotFoundError,
  HealthUnavailableError
)
export class ApplicationHealthErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    const status =
      error instanceof HealthNotFoundError
        ? 404
        : error instanceof HealthUnavailableError
        ? 503
        : 400;
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    if (status === 503) response.setHeader('Retry-After', '2');
    response
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
@Controller('catalog/application-health')
@UseFilters(ApplicationHealthErrorFilter)
export class ApplicationHealthController {
  constructor(private readonly health: ApplicationHealthClient) {}
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  read(@Param('slug') slug: string, @Query() query: unknown) {
    return this.health.read(slug, query);
  }
}
