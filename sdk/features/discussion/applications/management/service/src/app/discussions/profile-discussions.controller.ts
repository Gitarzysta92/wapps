import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { commentObject } from '@sdk/features/discussion/core';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { requiredActor } from './discussions.controller';
import { DiscussionErrorFilter } from './discussion-error.filter';
import { ProfileDiscussions } from './application/profile-discussions';

@Controller('internal/profile-discussions')
@UseFilters(DiscussionErrorFilter)
export class ProfileDiscussionsController {
  constructor(private readonly discussions: ProfileDiscussions) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  read(
    @Body() body: unknown,
    @Query() query: unknown,
    @AuthUser() user: AuthenticatedUser
  ) {
    commentObject(query, []);
    return this.discussions.read(body, requiredActor(user));
  }
}
