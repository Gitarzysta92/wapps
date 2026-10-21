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
import { suiteObject, SuiteInputError } from '@domains/publication/suite';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { SuitePublication } from './suite-publication';

@Controller('me/suites')
export class SuitePublicationController {
  constructor(private readonly publication: SuitePublication) {}
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

@Controller('editorial/suite-reviews')
export class SuiteReviewController {
  constructor(private readonly publication: SuitePublication) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor, @Query() query: unknown) {
    const data = suiteObject(query, ['page']);
    if (
      data.page !== undefined &&
      (typeof data.page !== 'string' || !/^[1-9][0-9]{0,4}$/.test(data.page))
    )
      throw new SuiteInputError('Invalid review page');
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
    const data = suiteObject(body, [
      'decision',
      'expectedRevision',
      'submittedRevision',
      'reason',
    ]);
    if (data.decision !== 'approve' && data.decision !== 'reject')
      throw new SuiteInputError('Invalid suite decision');
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
