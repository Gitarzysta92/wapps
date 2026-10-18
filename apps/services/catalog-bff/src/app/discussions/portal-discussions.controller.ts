import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request } from 'express';
import { discussionSelectionQuery, publicCommentId } from '@domains/community';
import {
  PortalDiscussionErrorFilter,
  PortalDiscussionRequest,
  discussionRequest,
} from './portal-discussions.request';
import {
  PortalDiscussionsClient,
  type DiscussionAction,
} from './portal-discussions.client';

@Controller()
@UseFilters(PortalDiscussionErrorFilter)
export class PortalDiscussionsController {
  constructor(
    private readonly requests: PortalDiscussionRequest,
    private readonly discussions: PortalDiscussionsClient
  ) {}
  @Get('application-discussions/:applicationId')
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: Request, @Param('applicationId') applicationId: string) {
    const actor = this.requests.viewer(request, ['cursor']);
    return this.discussions.list(
      actor,
      discussionRequest(() => publicCommentId(applicationId)),
      request.query.cursor
    );
  }
  @Get('application-discussions/:applicationId/:id')
  @Header('Cache-Control', 'private, no-store')
  read(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string
  ) {
    const actor = this.requests.viewer(request);
    return this.discussions.read(
      actor,
      discussionRequest(() => publicCommentId(applicationId)),
      discussionRequest(() => publicCommentId(id))
    );
  }
  @Get('me/discussions')
  @Header('Cache-Control', 'private, no-store')
  mine(@Req() request: Request) {
    const actor = this.requests.actor(request, ['cursor']);
    return this.discussions.mine(actor, request.query.cursor);
  }
  @Get('discussion-selection')
  @Header('Cache-Control', 'private, no-store')
  select(@Req() request: Request) {
    const actor = this.requests.viewer(request, ['ids']);
    return this.discussions.select(
      actor,
      discussionRequest(() => discussionSelectionQuery(request.query))
    );
  }
  @Post('application-discussions/:applicationId')
  @Header('Cache-Control', 'private, no-store')
  create(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, null, 'create', body);
  }
  @Post('application-discussions/:applicationId/:id/replies')
  @Header('Cache-Control', 'private, no-store')
  reply(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'reply', body);
  }
  @Put('application-discussions/:applicationId/:id')
  @Header('Cache-Control', 'private, no-store')
  edit(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'edit', body);
  }
  @Delete('application-discussions/:applicationId/:id')
  @Header('Cache-Control', 'private, no-store')
  remove(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'remove', body);
  }
  @Put('application-discussions/:applicationId/:id/vote')
  @Header('Cache-Control', 'private, no-store')
  vote(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'vote', body);
  }
  @Put('application-discussions/:applicationId/:id/pin')
  @Header('Cache-Control', 'private, no-store')
  pin(
    @Req() request: Request,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, applicationId, id, 'pin', body);
  }
  private change(
    request: Request,
    applicationId: string,
    id: string | null,
    action: DiscussionAction,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    return this.discussions.change(
      actor,
      discussionRequest(() => publicCommentId(applicationId)),
      id === null ? null : discussionRequest(() => publicCommentId(id)),
      action,
      body,
      this.requests.key(request)
    );
  }
}
