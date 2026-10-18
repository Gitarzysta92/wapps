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
  ownershipId,
  ownershipObject,
  parseOwnershipChangeInput,
  parseOwnershipClaimInput,
  type OwnershipAction,
} from '@domains/catalog/ownership';
import {
  applicationRequest,
  PortalApplicationErrorFilter,
  PortalApplicationRequest,
} from './portal-application.request';
import { PortalApplicationOwnershipClient } from './portal-application-ownership.client';

@Controller()
@UseFilters(PortalApplicationErrorFilter)
export class PortalApplicationOwnershipController {
  constructor(
    private readonly requests: PortalApplicationRequest,
    private readonly ownership: PortalApplicationOwnershipClient
  ) {}

  @Get('me/ownership-claims')
  @Header('Cache-Control', 'private, no-store')
  claims(@Req() request: Request) {
    return this.list(request, false);
  }

  @Get('editorial/ownership-reviews')
  @Header('Cache-Control', 'private, no-store')
  reviews(@Req() request: Request) {
    return this.list(request, true);
  }

  @Get('me/ownership-claims/:id')
  @Header('Cache-Control', 'private, no-store')
  claim(@Req() request: Request, @Param('id') id: string) {
    return this.read(request, id, false);
  }

  @Get('editorial/ownership-reviews/:id')
  @Header('Cache-Control', 'private, no-store')
  review(@Req() request: Request, @Param('id') id: string) {
    return this.read(request, id, true);
  }

  @Post('me/ownership-claims')
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: Request, @Body() body: unknown) {
    const actor = this.requests.actor(request);
    const key = this.requests.key(request);
    return this.ownership.create(
      actor,
      applicationRequest(() => parseOwnershipClaimInput(body)),
      key
    );
  }

  @Post('me/ownership-claims/:id/verify')
  @Header('Cache-Control', 'private, no-store')
  verify(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'verify', body);
  }

  @Post('me/ownership-claims/:id/cancel')
  @Header('Cache-Control', 'private, no-store')
  cancel(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'cancel', body);
  }

  @Post('me/ownership-claims/:id/release')
  @Header('Cache-Control', 'private, no-store')
  release(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'release', body);
  }

  @Post('editorial/ownership-reviews/:id/decision')
  @Header('Cache-Control', 'private, no-store')
  decide(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, null, body);
  }

  private list(request: Request, review: boolean) {
    const actor = this.requests.actor(
      request,
      review ? ['page', 'view'] : ['page']
    );
    const selectors = applicationRequest(() => {
      const { page, view } = request.query;
      if (
        (page !== undefined &&
          (typeof page !== 'string' ||
            !/^[1-9][0-9]{0,4}$/.test(page) ||
            Number(page) > 10000)) ||
        (view !== undefined && view !== 'pending' && view !== 'grants')
      )
        throw new Error('Invalid ownership selectors');
      return {
        page: page === undefined ? 1 : Number(page),
        grants: view === 'grants',
      };
    });
    return this.ownership.list(actor, review, selectors.page, selectors.grants);
  }

  private read(request: Request, id: string, review: boolean) {
    const actor = this.requests.actor(request);
    return this.ownership.read(
      actor,
      applicationRequest(() => ownershipId(id)),
      review
    );
  }

  private change(
    request: Request,
    id: string,
    action: Exclude<OwnershipAction, 'create'> | null,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    const key = this.requests.key(request);
    const command = applicationRequest(() => {
      let input = body;
      if (action === null) {
        const value = ownershipObject(body, [
          'decision',
          'expectedRevision',
          'reason',
        ]);
        if (
          value.decision !== 'approve' &&
          value.decision !== 'reject' &&
          value.decision !== 'revoke'
        )
          throw new Error('Invalid ownership decision');
        action = value.decision;
        input = {
          expectedRevision: value.expectedRevision,
          reason: value.reason,
        };
      }
      return {
        id: ownershipId(id),
        action,
        input: parseOwnershipChangeInput(action, input),
      };
    });
    return this.ownership.change(
      actor,
      command.id,
      command.action,
      command.input,
      key
    );
  }
}
