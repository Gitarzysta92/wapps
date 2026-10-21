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
import {
  PortalDiscussionErrorFilter,
  PortalDiscussionRequest,
  discussionRequest,
} from './portal-discussions.request';
import { PortalGenericDiscussionsClient } from './portal-generic-discussions.client';
import {
  genericDiscussionId,
  type GenericDiscussionAction,
} from './portal-generic-discussions.contract';

@Controller('discussions')
@UseFilters(PortalDiscussionErrorFilter)
export class PortalGenericDiscussionsController {
  constructor(
    private readonly requests: PortalDiscussionRequest,
    private readonly discussions: PortalGenericDiscussionsClient
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: Request) {
    return this.discussions.list(this.requests.viewer(request));
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  read(@Req() request: Request, @Param('id') id: string) {
    const viewer = this.requests.viewer(request);
    return this.discussions.read(
      viewer,
      discussionRequest(() => genericDiscussionId(id))
    );
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: Request, @Body() body: unknown) {
    return this.change(request, null, 'create', body);
  }

  @Post(':id/comments')
  @Header('Cache-Control', 'private, no-store')
  reply(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'reply', body);
  }

  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  edit(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'edit', body);
  }

  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  remove(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'remove', body);
  }

  @Post('comments/:id/like')
  @Header('Cache-Control', 'private, no-store')
  like(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'like', body);
  }

  @Delete('comments/:id/like')
  @Header('Cache-Control', 'private, no-store')
  unlike(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, id, 'unlike', body);
  }

  private change(
    request: Request,
    id: string | null,
    action: GenericDiscussionAction,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    return this.discussions.change(
      actor,
      id === null ? null : discussionRequest(() => genericDiscussionId(id)),
      action,
      body,
      this.requests.key(request)
    );
  }
}
