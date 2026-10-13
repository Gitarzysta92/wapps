import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  applicationDraftObject,
  ApplicationDraftInputError,
} from '@domains/catalog/record';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ApplicationPublication } from './application-publication';

@Controller('me/application-drafts')
export class ApplicationPublicationController {
  constructor(private readonly publication: ApplicationPublication) {}
  @Get(':id/publication')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.publication.read(actor, id);
  }
  @Post(':id/submit')
  @Header('Cache-Control', 'no-store')
  submit(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.publication.change(actor, id, 'submit', body, key);
  }
  @Post(':id/withdraw')
  @Header('Cache-Control', 'no-store')
  withdraw(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.publication.change(actor, id, 'withdraw', body, key);
  }
}

@Controller('editorial/application-reviews')
export class ApplicationReviewController {
  constructor(private readonly publication: ApplicationPublication) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor, @Query() query: unknown) {
    const data = applicationDraftObject(query, ['page']);
    if (
      data.page !== undefined &&
      (typeof data.page !== 'string' || !/^[1-9][0-9]{0,4}$/.test(data.page))
    )
      throw new ApplicationDraftInputError('Invalid review page');
    return this.publication.reviews(
      actor,
      data.page === undefined ? 1 : Number(data.page)
    );
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.publication.read(actor, id, true);
  }
  @Post(':id/decision')
  @Header('Cache-Control', 'no-store')
  decide(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const data = applicationDraftObject(body, [
      'decision',
      'expectedRevision',
      'submittedRevision',
      'reason',
    ]);
    if (data.decision !== 'approve' && data.decision !== 'reject')
      throw new ApplicationDraftInputError('Invalid application decision');
    return this.publication.change(
      actor,
      id,
      data.decision,
      {
        expectedRevision: data.expectedRevision,
        submittedRevision: data.submittedRevision,
        reason: data.reason,
      },
      key
    );
  }
}
