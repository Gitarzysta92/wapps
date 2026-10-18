import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Header,
  HttpException,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { parsePreferencesUpdate } from '@domains/customer/preferences';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';
import { PortalPreferencesClient } from './portal-preferences.client';

@Catch()
export class PortalPreferencesErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'no-store');
    if (status === 503 || status === 429)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException
          ? error.message
          : 'Preferences unavailable',
    });
  }
}

@Controller('me/preferences')
@UseFilters(PortalPreferencesErrorFilter)
export class PortalPreferencesController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly preferences: PortalPreferencesClient
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  read(@Req() request: Request) {
    const actor = this.identities.read(request);
    this.noQuery(request);
    if (
      request.headers['transfer-encoding'] !== undefined ||
      (request.headers['content-length'] !== undefined &&
        request.headers['content-length'] !== '0')
    )
      throw new BadRequestException('Preferences reads do not accept a body');
    return this.preferences.read(actor);
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  update(@Req() request: Request, @Body() body: unknown) {
    const actor = this.identities.read(request);
    this.noQuery(request);
    const key = singleHeader(request, 'idempotency-key', 128);
    if (!key || !/^[\x21-\x7e]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    let input;
    try {
      input = parsePreferencesUpdate(body);
    } catch {
      throw new BadRequestException('Invalid preferences change');
    }
    return this.preferences.update(actor, input, key);
  }

  private noQuery(request: Request) {
    if (Object.keys(request.query).length)
      throw new BadRequestException(
        'Preferences do not accept query parameters'
      );
  }
}
