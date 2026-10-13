import {
  Controller,
  Get,
  Header,
  Query,
  UseFilters,
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ExploreInputError,
  ExploreUnavailableError,
  TimelineMissingError,
} from '@domains/feed';
import { ExploreService } from './explore.service';

@Catch(ExploreInputError, ExploreUnavailableError, TimelineMissingError)
export class ExploreErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof ExploreInputError
        ? 400
        : error instanceof TimelineMissingError
        ? 404
        : 503;
    response.setHeader('Cache-Control', 'no-store');
    if (status === 503) response.setHeader('Retry-After', '2');
    response
      .status(status)
      .json({ statusCode: status, message: error.message });
  }
}
@Controller('explore')
@UseFilters(ExploreErrorFilter)
export class ExploreController {
  constructor(private readonly explore: ExploreService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  read(@Query() query: unknown) {
    return this.explore.read(query);
  }
}
