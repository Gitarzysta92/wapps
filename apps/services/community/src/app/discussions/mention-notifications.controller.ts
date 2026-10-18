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
import { DiscussionMentionNotifications } from './application/mention-notifications';

@Controller('internal/mention-notifications')
@UseFilters(DiscussionErrorFilter)
export class MentionNotificationsController {
  constructor(private readonly notifications: DiscussionMentionNotifications) {}
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
