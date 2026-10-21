import {
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
  applicationDraftId,
  applicationDraftObject,
  parseApplicationPublicationInput,
  type ApplicationPublicationAction,
} from '@domains/catalog/record';
import {
  applicationRequest,
  PortalApplicationErrorFilter,
  PortalApplicationRequest,
} from './portal-application.request';
import { PortalApplicationPublicationClient } from './portal-application-publication.client';

@Controller()
@UseFilters(PortalApplicationErrorFilter)
export class PortalApplicationPublicationController {
  constructor(
    private readonly requests: PortalApplicationRequest,
    private readonly publication: PortalApplicationPublicationClient
  ) {}

  @Get('me/application-drafts/:id/publication')
  @Header('Cache-Control', 'private, no-store')
  status(@Req() request: Request, @Param('id') id: string) {
    return this.read(request, id, false);
  }

  @Get('editorial/application-reviews/:id')
  @Header('Cache-Control', 'private, no-store')
  review(@Req() request: Request, @Param('id') id: string) {
    return this.read(request, id, true);
  }

  @Get('editorial/application-reviews')
  @Header('Cache-Control', 'private, no-store')
  reviews(@Req() request: Request) {
    const actor = this.requests.actor(request, ['page']);
    const page = applicationRequest(() => {
      const value = request.query.page;
      if (value === undefined) return 1;
      if (
        typeof value !== 'string' ||
        !/^[1-9][0-9]{0,4}$/.test(value) ||
        Number(value) > 10000
      )
        throw new Error('Invalid review page');
      return Number(value);
    });
    return this.publication.reviews(actor, page);
  }

  @Post('me/application-drafts/:id/submit')
  @Header('Cache-Control', 'private, no-store')
  submit(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'submit', body);
  }

  @Post('me/application-drafts/:id/withdraw')
  @Header('Cache-Control', 'private, no-store')
  withdraw(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'withdraw', body);
  }

  @Post('editorial/application-reviews/:id/decision')
  @Header('Cache-Control', 'private, no-store')
  decide(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, null, body);
  }

  private read(request: Request, id: string, review: boolean) {
    const actor = this.requests.actor(request);
    return this.publication.status(
      actor,
      applicationRequest(() => applicationDraftId(id)),
      review
    );
  }

  private change(
    request: Request,
    id: string,
    action: ApplicationPublicationAction | null,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    const key = this.requests.key(request);
    const command = applicationRequest(() => {
      let input = body;
      if (action === null) {
        const value = applicationDraftObject(body, [
          'decision',
          'expectedRevision',
          'submittedRevision',
          'reason',
        ]);
        if (value.decision !== 'approve' && value.decision !== 'reject')
          throw new Error('Invalid review decision');
        action = value.decision;
        input = {
          expectedRevision: value.expectedRevision,
          submittedRevision: value.submittedRevision,
          reason: value.reason,
        };
      }
      return {
        id: applicationDraftId(id),
        action,
        input: parseApplicationPublicationInput(action, input),
      };
    });
    return this.publication.change(
      actor,
      command.id,
      command.action,
      command.input,
      key
    );
  }
}
