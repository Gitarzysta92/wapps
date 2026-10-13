import { Controller, Get, Header, Query, UseFilters } from '@nestjs/common';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { requiredActor } from './discussions.controller';
import { DiscussionErrorFilter } from './discussion-error.filter';
import { MyDiscussions } from './application/my-discussions';

@Controller('me/discussions')
@UseFilters(DiscussionErrorFilter)
export class MyDiscussionsController {
  constructor(private readonly discussions: MyDiscussions) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: unknown, @AuthUser() user: AuthenticatedUser) {
    return this.discussions.list(requiredActor(user), query);
  }
}
