import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  parsePublicSuiteQuery,
  parsePublicSuiteSelectionQuery,
  parseSuitePublicationInput,
  suiteId,
  suiteObject,
  type SuitePublicationAction,
} from '@domains/publication/suite';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';
import { PortalSuitesErrorFilter } from './portal-suites.controller';
import { PortalSuitePublicationClient } from './portal-suite-publication.client';

@Controller()
@UseFilters(PortalSuitesErrorFilter)
export class PortalSuitePublicationController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly suites: PortalSuitePublicationClient
  ) {}

  @Get('me/suites/:id/publication')
  @Header('Cache-Control', 'private, no-store')
  status(@Req() request: Request, @Param('id') id: string) {
    return this.readStatus(request, id, false);
  }

  @Get('editorial/suite-reviews/:id')
  @Header('Cache-Control', 'private, no-store')
  review(@Req() request: Request, @Param('id') id: string) {
    return this.readStatus(request, id, true);
  }

  @Get('editorial/suite-reviews')
  @Header('Cache-Control', 'private, no-store')
  reviews(@Req() request: Request) {
    const actor = this.actor(request);
    const page = this.parse(() => {
      const data = suiteObject(request.query, ['page']);
      if (data.page === undefined) return 1;
      if (
        typeof data.page !== 'string' ||
        !/^[1-9][0-9]{0,4}$/.test(data.page) ||
        Number(data.page) > 10000
      )
        throw new Error('Invalid review page');
      return Number(data.page);
    });
    return this.suites.reviews(actor, page);
  }

  @Post('me/suites/:id/submit')
  @Header('Cache-Control', 'private, no-store')
  submit(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'submit', body);
  }

  @Post('me/suites/:id/withdraw')
  @Header('Cache-Control', 'private, no-store')
  withdraw(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'withdraw', body);
  }

  @Post('editorial/suite-reviews/:id/decision')
  @Header('Cache-Control', 'private, no-store')
  decide(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, null, body);
  }

  @Get('catalog/suites')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  browse(@Req() request: Request) {
    const actor = this.actor(request, true);
    return this.suites.browse(
      actor,
      this.parse(() => parsePublicSuiteQuery(request.query))
    );
  }

  @Get('catalog/suites/:id')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  find(@Req() request: Request, @Param('id') id: string) {
    const actor = this.actor(request, true);
    this.noQuery(request);
    return this.suites.find(
      actor,
      this.parse(() => suiteId(id))
    );
  }

  @Get('catalog/suite-selection')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  select(@Req() request: Request) {
    const actor = this.actor(request, true);
    return this.suites.select(
      actor,
      this.parse(() => parsePublicSuiteSelectionQuery(request.query))
    );
  }

  private readStatus(request: Request, id: string, review: boolean) {
    const actor = this.actor(request);
    this.noQuery(request);
    return this.suites.status(
      actor,
      this.parse(() => suiteId(id)),
      review
    );
  }

  private change(
    request: Request,
    id: string,
    action: SuitePublicationAction | null,
    body: unknown
  ) {
    const actor = this.actor(request);
    this.noQuery(request);
    const key = singleHeader(request, 'idempotency-key', 128);
    if (!key || !/^[A-Za-z0-9._:-]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    const command = this.parse(() => {
      let input = body;
      if (action === null) {
        const data = suiteObject(body, [
          'decision',
          'expectedRevision',
          'submittedRevision',
          'reason',
        ]);
        if (data.decision !== 'approve' && data.decision !== 'reject')
          throw new Error('Invalid decision');
        action = data.decision;
        input = {
          expectedRevision: data.expectedRevision,
          submittedRevision: data.submittedRevision,
          reason: data.reason,
        };
      }
      return {
        id: suiteId(id),
        action,
        input: parseSuitePublicationInput(action, input),
      };
    });
    return this.suites.change(
      actor,
      command.id,
      command.action,
      command.input,
      key
    );
  }

  private actor(request: Request, optional = false) {
    const actor = optional
      ? this.identities.readOptional(request)
      : this.identities.read(request);
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      (request.headers['transfer-encoding'] !== undefined ||
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0'))
    )
      throw new BadRequestException('Suite reads do not accept a body');
    return actor;
  }

  private noQuery(request: Request) {
    this.parse(() => suiteObject(request.query, []));
  }

  private parse<T>(read: () => T): T {
    try {
      return read();
    } catch {
      throw new BadRequestException('Invalid suite publication request');
    }
  }
}
