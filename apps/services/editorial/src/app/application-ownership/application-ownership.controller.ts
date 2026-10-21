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
import { OwnershipInputError } from '@domains/catalog/ownership';
import { applicationDraftObject } from '@domains/catalog/record';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ApplicationOwnership } from './application-ownership';

function page(input: unknown) {
  const value = applicationDraftObject(input, ['page']);
  if (value['page'] === undefined) return 1;
  if (
    typeof value['page'] !== 'string' ||
    !/^[1-9][0-9]{0,4}$/.test(value['page'])
  )
    throw new OwnershipInputError('Invalid ownership page');
  return Number(value['page']);
}

@Controller('me/ownership-claims')
export class ApplicationOwnershipController {
  constructor(private readonly ownership: ApplicationOwnership) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor, @Query() query: unknown) {
    return this.ownership.list(actor, false, page(query));
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.ownership.read(actor, id);
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @EditorialUser() actor: EditorialActor,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.ownership.create(actor, body, key);
  }
  @Post(':id/:action')
  @Header('Cache-Control', 'no-store')
  change(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    if (action !== 'verify' && action !== 'cancel' && action !== 'release')
      throw new OwnershipInputError('Invalid ownership action');
    return this.ownership.change(actor, id, action, body, key);
  }
}

@Controller('editorial/ownership-reviews')
export class ApplicationOwnershipReviewController {
  constructor(private readonly ownership: ApplicationOwnership) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor, @Query() query: unknown) {
    const value = applicationDraftObject(query, ['page', 'view']);
    if (
      value['view'] !== undefined &&
      value['view'] !== 'pending' &&
      value['view'] !== 'grants'
    )
      throw new OwnershipInputError('Invalid ownership review view');
    return this.ownership.list(
      actor,
      true,
      page({ page: value['page'] }),
      value['view'] === 'grants'
    );
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.ownership.read(actor, id, true);
  }
  @Post(':id/decision')
  @Header('Cache-Control', 'no-store')
  decide(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const value = applicationDraftObject(body, [
      'decision',
      'expectedRevision',
      'reason',
    ]);
    if (
      value['decision'] !== 'approve' &&
      value['decision'] !== 'reject' &&
      value['decision'] !== 'revoke'
    )
      throw new OwnershipInputError('Invalid ownership decision');
    return this.ownership.change(
      actor,
      id,
      value['decision'],
      { expectedRevision: value['expectedRevision'], reason: value['reason'] },
      key
    );
  }
}
