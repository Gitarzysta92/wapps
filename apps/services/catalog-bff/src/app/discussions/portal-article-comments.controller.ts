import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request } from 'express';
import { publicCommentId } from '@domains/community';
import {
  PortalDiscussionErrorFilter,
  PortalDiscussionRequest,
  discussionRequest,
} from './portal-discussions.request';
import {
  PortalArticleCommentsClient,
  type ArticleCommentAction,
} from './portal-article-comments.client';

@Controller('article-comments/:articleId')
@UseFilters(PortalDiscussionErrorFilter)
export class PortalArticleCommentsController {
  constructor(
    private readonly requests: PortalDiscussionRequest,
    private readonly comments: PortalArticleCommentsClient
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: Request, @Param('articleId') articleId: string) {
    const actor = this.requests.viewer(request, ['cursor']);
    return this.comments.list(
      actor,
      discussionRequest(() => publicCommentId(articleId)),
      request.query.cursor
    );
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  read(
    @Req() request: Request,
    @Param('articleId') articleId: string,
    @Param('id') id: string
  ) {
    const actor = this.requests.viewer(request);
    return this.comments.read(
      actor,
      discussionRequest(() => publicCommentId(articleId)),
      discussionRequest(() => publicCommentId(id))
    );
  }
  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(
    @Req() request: Request,
    @Param('articleId') articleId: string,
    @Body() body: unknown
  ) {
    return this.change(request, articleId, null, 'create', body);
  }
  @Post(':id/replies')
  @Header('Cache-Control', 'private, no-store')
  reply(
    @Req() request: Request,
    @Param('articleId') articleId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, articleId, id, 'reply', body);
  }
  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  edit(
    @Req() request: Request,
    @Param('articleId') articleId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, articleId, id, 'edit', body);
  }
  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  remove(
    @Req() request: Request,
    @Param('articleId') articleId: string,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.change(request, articleId, id, 'remove', body);
  }
  private change(
    request: Request,
    articleId: string,
    id: string | null,
    action: ArticleCommentAction,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    return this.comments.change(
      actor,
      discussionRequest(() => publicCommentId(articleId)),
      id === null ? null : discussionRequest(() => publicCommentId(id)),
      action,
      body,
      this.requests.key(request)
    );
  }
}
