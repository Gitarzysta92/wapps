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
import { ProfileDiscussionTotals } from './application/profile-totals';

@Controller('internal/profile-totals')
@UseFilters(DiscussionErrorFilter)
export class ProfileTotalsController {
  constructor(private readonly activity: ProfileDiscussionTotals) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  read(
    @Body() body: unknown,
    @Query() query: unknown,
    @AuthUser() user: AuthenticatedUser
  ) {
    commentObject(query, []);
    return this.activity.read(body, requiredActor(user));
  }
}
