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
  Param,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { healthId } from '@domains/reliability';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalHealthMonitorsClient } from './portal-health-monitors.client';
import { healthMonitorInput } from './portal-health-monitors.contracts';

function input<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw new BadRequestException('Invalid health monitor request');
  }
}

@Catch()
export class PortalHealthMonitorsErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (status === 429 || status === 503)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException
          ? error.message
          : 'Health monitor configuration unavailable',
    });
  }
}

@Controller('editorial/health-monitors')
@UseFilters(PortalHealthMonitorsErrorFilter)
export class PortalHealthMonitorsController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly monitors: PortalHealthMonitorsClient
  ) {}

  @Get(':applicationId')
  @Header('Cache-Control', 'private, no-store')
  configurations(
    @Req() request: Request,
    @Param('applicationId') applicationId: string
  ) {
    const actor = this.actor(request, applicationId);
    return this.monitors.configurations(actor, applicationId);
  }

  @Put(':applicationId/:id')
  @Header('Cache-Control', 'private, no-store')
  configure(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const actor = this.actor(request, applicationId);
    const command = input(() =>
      healthMonitorInput(applicationId, healthId(id), body)
    );
    return this.monitors.configure(actor, applicationId, id, command);
  }

  private actor(request: Request, applicationId: string) {
    const actor = this.identities.read(request);
    input(() => healthId(applicationId));
    if (
      Object.keys(request.query).length ||
      (['GET', 'HEAD'].includes(request.method) &&
        (request.headers['transfer-encoding'] !== undefined ||
          (request.headers['content-length'] !== undefined &&
            request.headers['content-length'] !== '0')))
    )
      throw new BadRequestException(
        'Health monitor requests accept no query parameters or read body'
      );
    return actor;
  }
}
