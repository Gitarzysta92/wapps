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
import { ArticleComments } from './application/article-comments';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { discussionActor, requiredActor } from './discussions.controller';
import { DiscussionErrorFilter } from './discussion-error.filter';

@Controller('article-comments/:articleId')
@UseFilters(DiscussionErrorFilter)
export class ArticleCommentsController {
  constructor(private readonly comments: ArticleComments) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Param('articleId') articleId: string,
    @Query() query: unknown,
    @AuthUser({ optional: true }) user: AuthenticatedUser
  ) {
    return this.comments.list(articleId, query, discussionActor(user));
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(
    @Param('articleId') articleId: string,
    @Param('id') id: string,
    @AuthUser({ optional: true }) user: AuthenticatedUser
  ) {
    return this.comments.read(articleId, id, discussionActor(user));
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Param('articleId') articleId: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.comments.create(articleId, body, requiredActor(user), key);
  }

  @Post(':id/replies')
  @Header('Cache-Control', 'no-store')
  reply(
    @Param('articleId') articleId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.comments.reply(articleId, id, body, requiredActor(user), key);
  }

  @Put(':id')
  @Header('Cache-Control', 'no-store')
  edit(
    @Param('articleId') articleId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.comments.edit(articleId, id, body, requiredActor(user), key);
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  remove(
    @Param('articleId') articleId: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string
  ) {
    return this.comments.remove(articleId, id, body, requiredActor(user), key);
  }
}
