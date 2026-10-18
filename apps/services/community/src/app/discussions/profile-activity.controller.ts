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
import { ProfileCommunityActivity } from './application/profile-activity';

@Controller('internal/profile-activity')
@UseFilters(DiscussionErrorFilter)
export class ProfileActivityController {
  constructor(private readonly activity: ProfileCommunityActivity) {}
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
