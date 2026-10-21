import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  Header,
  HttpCode,
  HttpException,
  MethodNotAllowedException,
  Param,
  Post,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  accountExportId,
  accountExportObject,
} from '@sdk/features/identity/core';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';
import { PortalExportsClient } from './portal-exports.client';
import { PortalExportDownloads } from './portal-exports.download';

@Catch()
export class PortalExportsErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.destroyed) return;
    if (response.headersSent) {
      response.destroy();
      return;
    }
    for (const name of [
      'Content-Length',
      'Content-Disposition',
      'Content-Type',
    ])
      response.removeHeader(name);
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; sandbox"
    );
    if (status === 429 || status === 503)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException
          ? error.message
          : 'Account export unavailable',
    });
  }
}

@Controller('me/exports')
@UseFilters(PortalExportsErrorFilter)
export class PortalExportsController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly exports: PortalExportsClient,
    private readonly downloads: PortalExportDownloads
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  latest(@Req() request: Request) {
    return this.exports.latest(this.actor(request));
  }

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: Request, @Body() body: unknown) {
    const actor = this.actor(request);
    this.empty(body);
    const key = singleHeader(request, 'idempotency-key', 128);
    if (!key || !/^[\x21-\x7e]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    return this.exports.request(actor, key);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  inspect(@Req() request: Request, @Param('id') id: string) {
    const actor = this.actor(request);
    return this.exports.inspect(actor, this.id(id));
  }

  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  cancel(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const actor = this.actor(request);
    this.empty(body ?? {});
    return this.exports.cancel(actor, this.id(id));
  }

  @Get(':id/download')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  download(
    @Req() request: Request,
    @Param('id') id: string,
    @Res() response: Response
  ) {
    const actor = this.actor(request);
    if (request.method !== 'GET')
      throw new MethodNotAllowedException('Download with GET');
    if (request.headers.range !== undefined)
      throw new BadRequestException(
        'Download the complete archive without a Range header'
      );
    return this.downloads.send(actor, this.id(id), request, response);
  }

  private actor(request: Request) {
    const actor = this.identities.read(request);
    this.empty(request.query);
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      (request.headers['transfer-encoding'] !== undefined ||
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0'))
    )
      throw new BadRequestException('Export reads do not accept a body');
    return actor;
  }

  private id(value: string) {
    try {
      return accountExportId(value);
    } catch {
      throw new BadRequestException('Invalid account export ID');
    }
  }
  private empty(value: unknown) {
    try {
      accountExportObject(value, []);
    } catch {
      throw new BadRequestException('Unexpected account export fields');
    }
  }
}
