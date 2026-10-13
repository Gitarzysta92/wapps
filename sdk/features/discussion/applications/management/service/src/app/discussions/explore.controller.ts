import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { exploreObject } from '@domains/feed';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { requiredActor } from './discussions.controller';
import { DiscussionErrorFilter } from './discussion-error.filter';
import { ExploreCommunity } from './application/explore-community';

@Controller('internal/explore')
@UseFilters(DiscussionErrorFilter)
export class ExploreController {
  constructor(private readonly explore: ExploreCommunity) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  read(
    @Body() body: unknown,
    @Query() query: unknown,
    @AuthUser() user: AuthenticatedUser
  ) {
    exploreObject(query, []);
    return this.explore.read(body, requiredActor(user));
  }
}
