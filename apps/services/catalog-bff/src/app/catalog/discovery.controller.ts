import {
  Catch,
  Controller,
  Get,
  Header,
  Query,
  UseFilters,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DiscoveryInputError,
  DiscoveryUnavailableError,
} from '@domains/discovery';
import { PublicDiscoveryService } from './discovery.service';

@Catch(DiscoveryInputError, DiscoveryUnavailableError)
export class DiscoveryErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof DiscoveryInputError ? 400 : 503;
    response.setHeader('Cache-Control', 'no-store');
    if (status === 503) response.setHeader('Retry-After', '2');
    response
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
@Controller('catalog/discover')
@UseFilters(DiscoveryErrorFilter)
export class PublicDiscoveryController {
  constructor(private readonly discovery: PublicDiscoveryService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  search(@Query() query: unknown) {
    return this.discovery.search(query);
  }
}
