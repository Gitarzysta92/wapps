import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EditorialCommands } from '../application/editorial-commands';
import { EditorialQueries } from '../application/editorial-queries';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';

@ApiTags('apps')
@Controller('apps')
export class AppsController {
  constructor(
    private readonly commands: EditorialCommands,
    private readonly queries: EditorialQueries
  ) {}

  @Get()
  findAll(@EditorialUser(true) actor: EditorialActor | null) {
    return this.queries.list('app', actor);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @EditorialUser(true) actor: EditorialActor | null
  ) {
    return this.queries.find('app', id, actor);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create an authorized catalog resource with a durable materialization intent',
  })
  create(
    @Body() input: unknown,
    @EditorialUser() actor: EditorialActor,
    @Headers('idempotency-key') key: string
  ) {
    return this.commands.create('app', input, actor, key);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() input: unknown,
    @EditorialUser() actor: EditorialActor,
    @Headers('idempotency-key') key: string
  ) {
    return this.commands.update('app', id, input, actor, key);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Body() input: unknown,
    @EditorialUser() actor: EditorialActor,
    @Headers('idempotency-key') key: string
  ) {
    return this.commands.remove('app', id, input, actor, key);
  }
}
