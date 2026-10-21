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
  parseReleaseBrowseFilter,
  parseReleasePublicationInput,
  releaseId,
  releaseObject,
  releaseVersion,
  type ReleasePublicationAction,
} from '@domains/catalog/versioning';
import {
  PortalReleaseErrorFilter,
  PortalReleaseRequest,
  releasePage,
  releaseRequest,
  releaseSlug,
} from './portal-releases.request';
import {
  PortalReleasesClient,
  type ReleaseDraftAction,
} from './portal-releases.client';

@Controller()
@UseFilters(PortalReleaseErrorFilter)
export class PortalReleasesController {
  constructor(
    private readonly requests: PortalReleaseRequest,
    private readonly releases: PortalReleasesClient
  ) {}

  @Get('me/releases')
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: Request) {
    return this.releases.list(this.requests.actor(request));
  }
  @Get('me/releases/source/:applicationId')
  @Header('Cache-Control', 'private, no-store')
  source(
    @Req() request: Request,
    @Param('applicationId') applicationId: string
  ) {
    const actor = this.requests.actor(request, ['releaseId']);
    const target = releaseRequest(() => ({
      applicationId: releaseId(applicationId),
      id:
        request.query.releaseId === undefined
          ? null
          : releaseId(request.query.releaseId),
    }));
    return this.releases.source(actor, target.applicationId, target.id);
  }
  @Get('me/releases/:id')
  @Header('Cache-Control', 'private, no-store')
  read(@Req() request: Request, @Param('id') id: string) {
    const actor = this.requests.actor(request);
    return this.releases.read(
      actor,
      releaseRequest(() => releaseId(id))
    );
  }
  @Post('me/releases')
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: Request, @Body() body: unknown) {
    return this.draft(request, 'create', null, body);
  }
  @Post('me/releases/open')
  @Header('Cache-Control', 'private, no-store')
  open(@Req() request: Request, @Body() body: unknown) {
    return this.draft(request, 'open', null, body);
  }
  @Put('me/releases/:id')
  @Header('Cache-Control', 'private, no-store')
  update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.draft(request, 'update', id, body);
  }
  @Post('me/releases/:id/rebase')
  @Header('Cache-Control', 'private, no-store')
  rebase(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.draft(request, 'rebase', id, body);
  }
  @Delete('me/releases/:id')
  @Header('Cache-Control', 'private, no-store')
  remove(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.draft(request, 'delete', id, body);
  }
  @Get('me/releases/:id/publication')
  @Header('Cache-Control', 'private, no-store')
  status(@Req() request: Request, @Param('id') id: string) {
    return this.publication(request, id, false);
  }
  @Get('editorial/release-reviews/:id')
  @Header('Cache-Control', 'private, no-store')
  review(@Req() request: Request, @Param('id') id: string) {
    return this.publication(request, id, true);
  }
  @Get('editorial/release-reviews')
  @Header('Cache-Control', 'private, no-store')
  reviews(@Req() request: Request) {
    const actor = this.requests.actor(request, ['page']);
    return this.releases.reviews(
      actor,
      releaseRequest(() => releasePage(request.query.page))
    );
  }
  @Post('me/releases/:id/submit')
  @Header('Cache-Control', 'private, no-store')
  submit(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.publish(request, id, 'submit', body);
  }
  @Post('me/releases/:id/withdraw')
  @Header('Cache-Control', 'private, no-store')
  withdraw(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.publish(request, id, 'withdraw', body);
  }
  @Post('editorial/release-reviews/:id/decision')
  @Header('Cache-Control', 'private, no-store')
  decide(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.publish(request, id, null, body);
  }
  @Get('catalog/releases/:slug')
  @Header('Cache-Control', 'private, no-store')
  browse(@Req() request: Request, @Param('slug') slug: string) {
    const actor = this.requests.viewer(request, ['page', 'channel', 'before']);
    const query = releaseRequest(() => ({
      slug: releaseSlug(slug),
      page: releasePage(request.query.page),
      filter: parseReleaseBrowseFilter({
        channel: request.query.channel,
        before: request.query.before,
      }),
    }));
    return this.releases.browse(actor, query.slug, query.page, query.filter);
  }
  @Get('catalog/releases/:slug/:version')
  @Header('Cache-Control', 'private, no-store')
  find(
    @Req() request: Request,
    @Param('slug') slug: string,
    @Param('version') version: string
  ) {
    const actor = this.requests.viewer(request);
    const query = releaseRequest(() => ({
      slug: releaseSlug(slug),
      version: releaseVersion(version),
    }));
    return this.releases.find(actor, query.slug, query.version);
  }

  private draft(
    request: Request,
    action: ReleaseDraftAction,
    id: string | null,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    return this.releases.draft(
      actor,
      action,
      id,
      body,
      this.requests.key(request)
    );
  }
  private publication(request: Request, id: string, review: boolean) {
    const actor = this.requests.actor(request);
    return this.releases.status(
      actor,
      releaseRequest(() => releaseId(id)),
      review
    );
  }
  private publish(
    request: Request,
    id: string,
    action: ReleasePublicationAction | null,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    const key = this.requests.key(request);
    const command = releaseRequest(() => {
      let input = body;
      if (action === null) {
        const value = releaseObject(body, [
          'decision',
          'expectedRevision',
          'expectedPublicationRevision',
          'submittedRevision',
          'reason',
        ]);
        if (value.decision !== 'approve' && value.decision !== 'reject')
          throw new Error('Invalid release decision');
        action = value.decision;
        input = {
          expectedRevision: value.expectedRevision,
          expectedPublicationRevision: value.expectedPublicationRevision,
          submittedRevision: value.submittedRevision,
          reason: value.reason,
        };
      }
      return {
        id: releaseId(id),
        action,
        input: parseReleasePublicationInput(action, input),
      };
    });
    return this.releases.publish(
      actor,
      command.id,
      command.action,
      command.input,
      key
    );
  }
}
