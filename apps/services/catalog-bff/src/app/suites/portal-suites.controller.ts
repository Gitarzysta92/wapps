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
  HttpException,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  parseSuiteFields,
  suiteId,
  suiteObject,
  suiteRevision,
} from '@domains/publication/suite';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';
import {
  PortalSuitesClient,
  type PortalSuiteChange,
} from './portal-suites.client';

@Catch()
export class PortalSuitesErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    if (status === 429 || status === 503)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException ? error.message : 'Suite unavailable',
    });
  }
}

@Controller('me/suites')
@UseFilters(PortalSuitesErrorFilter)
export class PortalSuitesController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly suites: PortalSuitesClient
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: Request) {
    return this.suites.list(this.actor(request));
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  read(@Req() request: Request, @Param('id') id: string) {
    const actor = this.actor(request);
    return this.suites.read(
      actor,
      this.parse(() => suiteId(id))
    );
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: Request, @Body() body: unknown) {
    return this.change(request, 'POST', null, body);
  }

  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, 'PUT', id, body);
  }

  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  remove(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, 'DELETE', id, body);
  }

  private change(
    request: Request,
    method: PortalSuiteChange['method'],
    id: string | null,
    body: unknown
  ) {
    const actor = this.actor(request);
    const key = singleHeader(request, 'idempotency-key', 128);
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    const command = this.parse((): PortalSuiteChange => {
      const fields = [
        'title',
        'description',
        'applicationIds',
        'classification',
      ];
      const row = suiteObject(
        body,
        method === 'DELETE'
          ? ['expectedRevision']
          : method === 'POST'
          ? fields
          : [...fields, 'expectedRevision']
      );
      return {
        method,
        id: method === 'POST' ? null : suiteId(id),
        expectedRevision:
          method === 'POST' ? null : suiteRevision(row['expectedRevision']),
        fields:
          method === 'DELETE'
            ? null
            : parseSuiteFields({
                title: row['title'],
                description: row['description'],
                applicationIds: row['applicationIds'],
                classification: row['classification'],
              }),
      };
    });
    return this.suites.change(actor, command, key);
  }

  private actor(request: Request) {
    const actor = this.identities.read(request);
    this.parse(() => suiteObject(request.query, []));
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      (request.headers['transfer-encoding'] !== undefined ||
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0'))
    )
      throw new BadRequestException('Suite reads do not accept a body');
    return actor;
  }

  private parse<T>(read: () => T): T {
    try {
      return read();
    } catch {
      throw new BadRequestException('Invalid suite request');
    }
  }
}
