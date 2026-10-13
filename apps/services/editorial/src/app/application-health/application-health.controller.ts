import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ApplicationHealth } from './application-health';
import { PublicApplicationHealth } from './public-application-health';

@Controller('catalog/application-health')
export class PublicApplicationHealthController {
  constructor(private readonly health: PublicApplicationHealth) {}
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  read(@Param('slug') slug: string, @Query() query: unknown) {
    return this.health.read(slug, query);
  }
}
@Controller('editorial/health-monitors')
export class ApplicationHealthManagementController {
  constructor(private readonly health: ApplicationHealth) {}
  @Get(':applicationId')
  @Header('Cache-Control', 'no-store')
  configurations(
    @EditorialUser() actor: EditorialActor,
    @Param('applicationId') id: string,
    @Query() query: unknown
  ) {
    return this.health.configurations(actor, id, query);
  }
  @Put(':applicationId/:id')
  @Header('Cache-Control', 'no-store')
  configure(
    @EditorialUser() actor: EditorialActor,
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() input: unknown
  ) {
    return this.health.configure(actor, applicationId, id, input);
  }
}
