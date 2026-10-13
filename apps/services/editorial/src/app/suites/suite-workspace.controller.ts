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
import { SuiteWorkspace } from './suite-workspace';

@Controller('me/suites')
export class SuiteWorkspaceController {
  constructor(private readonly workspace: SuiteWorkspace) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor) {
    return this.workspace.list(actor);
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
