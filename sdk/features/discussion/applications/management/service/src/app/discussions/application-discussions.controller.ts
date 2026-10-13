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
  UseFilters,
} from '@nestjs/common';
import { ApplicationDiscussions } from './application/application-discussions';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { discussionActor, requiredActor } from './discussions.controller';
import { DiscussionErrorFilter } from './discussion-error.filter';

@Controller('application-discussions/:applicationId')
@UseFilters(DiscussionErrorFilter)
export class ApplicationDiscussionsController {
  constructor(private readonly discussions: ApplicationDiscussions) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Param('applicationId') applicationId: string,
    @Query() query: unknown,
    @AuthUser({ optional: true }) user: AuthenticatedUser
  ) {
    return this.discussions.list(applicationId, query, discussionActor(user));
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @AuthUser({ optional: true }) user: AuthenticatedUser
  ) {
    return this.discussions.read(applicationId, id, discussionActor(user));
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Param('applicationId') applicationId: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.create(
      applicationId,
      body,
      requiredActor(user),
      key
    );
  }

  @Post(':id/replies')
  @Header('Cache-Control', 'no-store')
  reply(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.reply(
      applicationId,
      id,
      body,
      requiredActor(user),
      key
    );
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  edit(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.edit(
      applicationId,
      id,
      body,
      requiredActor(user),
      key
    );
  }

  @Put(':id/vote')
  @Header('Cache-Control', 'no-store')
  vote(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.vote(
      applicationId,
      id,
      body,
      requiredActor(user),
      key
    );
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  remove(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.remove(
      applicationId,
      id,
      body,
      requiredActor(user),
      key
    );
  }

  @Put(':id/pin')
  @Header('Cache-Control', 'no-store')
  pin(
    @Param('applicationId') applicationId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.discussions.pin(
      applicationId,
      id,
      body,
      requiredActor(user),
      key
    );
  }
}
