import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  CatalogInputError,
  CatalogUnavailableError,
} from '@domains/catalog/record';

@Catch(CatalogInputError, CatalogUnavailableError)
export class CatalogErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    const status = error instanceof CatalogInputError ? 400 : 503;
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    if (status === 503) response.setHeader('Retry-After', '2');
    response
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
