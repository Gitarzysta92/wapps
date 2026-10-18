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
import { applicationDraftId } from '@domains/catalog/record';
import {
  PortalApplicationDraftsClient,
  type DraftAction,
} from './portal-application-drafts.client';
import {
  applicationRequest,
  PortalApplicationErrorFilter,
  PortalApplicationRequest,
} from './portal-application.request';

@Controller('me/application-drafts')
@UseFilters(PortalApplicationErrorFilter)
export class PortalApplicationDraftsController {
  constructor(
    private readonly requests: PortalApplicationRequest,
    private readonly drafts: PortalApplicationDraftsClient
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: Request) {
    return this.drafts.list(this.requests.actor(request));
  }
  @Get('canonical/:id')
  @Header('Cache-Control', 'private, no-store')
  source(@Req() request: Request, @Param('id') id: string) {
    const actor = this.requests.actor(request);
    return this.drafts.source(
      actor,
      applicationRequest(() => applicationDraftId(id))
    );
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  read(@Req() request: Request, @Param('id') id: string) {
    const actor = this.requests.actor(request);
    return this.drafts.read(
      actor,
      applicationRequest(() => applicationDraftId(id))
    );
  }
  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: Request, @Body() body: unknown) {
    return this.change(request, 'create', null, body);
  }
  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, 'update', id, body);
  }
  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  remove(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, 'delete', id, body);
  }
  @Post('from-application')
  @Header('Cache-Control', 'private, no-store')
  open(@Req() request: Request, @Body() body: unknown) {
    return this.change(request, 'open', null, body);
  }
  @Post(':id/rebase')
  @Header('Cache-Control', 'private, no-store')
  rebase(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, 'rebase', id, body);
  }
  @Put(':id/images')
  @Header('Cache-Control', 'private, no-store')
  images(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, 'images', id, body);
  }
  private change(
    request: Request,
    action: DraftAction,
    id: string | null,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    return this.drafts.change(
      actor,
      action,
      id,
      body,
      this.requests.key(request)
    );
  }
}
