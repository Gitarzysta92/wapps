import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  releaseObject,
  ReleaseInputError,
  parseReleaseBrowseFilter,
} from '@domains/catalog/versioning';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ReleaseWorkspace } from './release-workspace';
import { ReleaseCatalog } from './release-catalog';

function pageQuery(query: unknown) {
  const data = releaseObject(query, ['page']);
  if (
    data.page !== undefined &&
    (typeof data.page !== 'string' || !/^[1-9][0-9]{0,4}$/.test(data.page))
  )
    throw new ReleaseInputError('Invalid release page');
  return data.page === undefined ? 1 : Number(data.page);
}

@Controller('me/releases')
export class ReleasesController {
  constructor(private readonly workspace: ReleaseWorkspace) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor) {
    return this.workspace.list(actor);
  }
  @Get('source/:applicationId')
  @Header('Cache-Control', 'no-store')
  source(
    @EditorialUser() actor: EditorialActor,
    @Param('applicationId') applicationId: string,
    @Query() query: unknown
  ) {
    const data = releaseObject(query, ['releaseId']);
    if (data.releaseId !== undefined && typeof data.releaseId !== 'string')
      throw new ReleaseInputError('Invalid release source');
    return this.workspace.source(actor, applicationId, data.releaseId ?? null);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.workspace.read(actor, id);
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @EditorialUser() actor: EditorialActor,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.changeDraft(actor, 'create', null, body, key);
  }
  @Post('open')
  @Header('Cache-Control', 'no-store')
  open(
    @EditorialUser() actor: EditorialActor,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.changeDraft(actor, 'open', null, body, key);
  }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.changeDraft(actor, 'update', id, body, key);
  }
  @Post(':id/rebase')
  @Header('Cache-Control', 'no-store')
  rebase(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.changeDraft(actor, 'rebase', id, body, key);
  }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  remove(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.changeDraft(actor, 'delete', id, body, key);
  }
  @Get(':id/publication')
  @Header('Cache-Control', 'no-store')
  status(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.workspace.status(actor, id);
  }
  @Post(':id/submit')
  @Header('Cache-Control', 'no-store')
  submit(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.changePublication(actor, id, 'submit', body, key);
  }
  @Post(':id/withdraw')
  @Header('Cache-Control', 'no-store')
  withdraw(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.changePublication(actor, id, 'withdraw', body, key);
  }
}

@Controller('editorial/release-reviews')
export class ReleaseReviewsController {
  constructor(private readonly workspace: ReleaseWorkspace) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor, @Query() query: unknown) {
    return this.workspace.reviews(actor, pageQuery(query));
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.workspace.status(actor, id, true);
  }
  @Post(':id/decision')
  @Header('Cache-Control', 'no-store')
  decide(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const data = releaseObject(body, [
      'decision',
      'expectedRevision',
      'expectedPublicationRevision',
      'submittedRevision',
      'reason',
    ]);
    if (data.decision !== 'approve' && data.decision !== 'reject')
      throw new ReleaseInputError('Invalid release review decision');
    return this.workspace.changePublication(
      actor,
      id,
      data.decision,
      {
        expectedRevision: data.expectedRevision,
        expectedPublicationRevision: data.expectedPublicationRevision,
        submittedRevision: data.submittedRevision,
        reason: data.reason,
      },
      key
    );
  }
}

@Controller('catalog/releases')
export class ReleaseCatalogController {
  constructor(private readonly catalog: ReleaseCatalog) {}
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  browse(@Param('slug') slug: string, @Query() query: unknown) {
    const value = releaseObject(query, ['page', 'channel', 'before']);
    return this.catalog.browse(
      slug,
      pageQuery({ page: value.page }),
      parseReleaseBrowseFilter({ channel: value.channel, before: value.before })
    );
  }
  @Get(':slug/:version')
  @Header('Cache-Control', 'no-store')
  find(
    @Param('slug') slug: string,
    @Param('version') version: string,
    @Query() query: unknown
  ) {
    releaseObject(query, []);
    return this.catalog.find(slug, version);
  }
}
