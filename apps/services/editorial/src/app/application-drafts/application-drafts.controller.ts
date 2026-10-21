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
} from '@nestjs/common';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ApplicationDrafts } from './application-drafts';

@Controller('me/application-drafts')
export class ApplicationDraftsController {
  constructor(private readonly workspace: ApplicationDrafts) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor) {
    return this.workspace.list(actor);
  }
  @Get('canonical/:id')
  @Header('Cache-Control', 'no-store')
  source(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.workspace.source(actor, id);
  }
  @Post('from-application')
  @Header('Cache-Control', 'no-store')
  open(
    @EditorialUser() actor: EditorialActor,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.editExisting(actor, 'open', null, body, key);
  }
  @Post(':id/rebase')
  @Header('Cache-Control', 'no-store')
  rebase(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.editExisting(actor, 'rebase', id, body, key);
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
    return this.workspace.change(actor, 'create', null, body, key);
  }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.change(actor, 'update', id, body, key);
  }
  @Put(':id/images')
  @Header('Cache-Control', 'no-store')
  images(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.changeImages(actor, id, body, key);
  }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  remove(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.change(actor, 'delete', id, body, key);
  }
}
