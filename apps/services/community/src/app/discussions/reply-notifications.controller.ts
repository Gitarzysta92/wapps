import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { commentObject } from '@domains/community';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { requiredActor } from './discussion-actor';
import { DiscussionErrorFilter } from './discussion-error.filter';
import { DiscussionReplyNotifications } from './application/reply-notifications';

@Controller('internal/reply-notifications')
@UseFilters(DiscussionErrorFilter)
export class ReplyNotificationsController {
  constructor(private readonly notifications: DiscussionReplyNotifications) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  execute(
    @Body() body: unknown,
    @Query() query: unknown,
    @AuthUser() user: AuthenticatedUser
  ) {
    commentObject(query, []);
    return this.notifications.execute(body, requiredActor(user));
  }
}
