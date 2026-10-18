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
import {
  parseArticleBrowseQuery,
  parseArticleSelectionQuery,
  articlePageNumber,
  articleSlug,
  parseArticlePublicationInput,
  articleId,
  articleObject,
  type ArticlePublicationAction,
} from '@domains/publication/article';
import {
  PortalArticleErrorFilter,
  PortalArticleRequest,
  articleRequest,
} from './portal-articles.request';
import {
  PortalArticlesClient,
  type ArticleDraftAction,
} from './portal-articles.client';

@Controller()
@UseFilters(PortalArticleErrorFilter)
export class PortalArticlesController {
  constructor(
    private readonly requests: PortalArticleRequest,
    private readonly articles: PortalArticlesClient
  ) {}

  @Get('me/articles')
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: Request) {
    return this.articles.list(this.requests.actor(request));
  }
  @Get('me/articles/:id')
  @Header('Cache-Control', 'private, no-store')
  read(@Req() request: Request, @Param('id') id: string) {
    const actor = this.requests.actor(request);
    return this.articles.read(
      actor,
      articleRequest(() => articleId(id))
    );
  }
  @Post('me/articles')
  @Header('Cache-Control', 'private, no-store')
  create(@Req() request: Request, @Body() body: unknown) {
    return this.draft(request, 'create', null, body);
  }
  @Put('me/articles/:id')
  @Header('Cache-Control', 'private, no-store')
  update(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.draft(request, 'update', id, body);
  }
  @Delete('me/articles/:id')
  @Header('Cache-Control', 'private, no-store')
  remove(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.draft(request, 'delete', id, body);
  }
  @Get('me/articles/:id/publication')
  @Header('Cache-Control', 'private, no-store')
  status(@Req() request: Request, @Param('id') id: string) {
    return this.publication(request, id, false);
  }
  @Get('editorial/article-reviews/:id')
  @Header('Cache-Control', 'private, no-store')
  review(@Req() request: Request, @Param('id') id: string) {
    return this.publication(request, id, true);
  }
  @Get('editorial/article-reviews')
  @Header('Cache-Control', 'private, no-store')
  reviews(@Req() request: Request) {
    const actor = this.requests.actor(request, ['page']);
    return this.articles.reviews(
      actor,
      articleRequest(() => articlePageNumber(request.query.page))
    );
  }
  @Post('me/articles/:id/submit')
  @Header('Cache-Control', 'private, no-store')
  submit(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.publish(request, id, 'submit', body);
  }
  @Post('me/articles/:id/withdraw')
  @Header('Cache-Control', 'private, no-store')
  withdraw(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.publish(request, id, 'withdraw', body);
  }
  @Post('editorial/article-reviews/:id/decision')
  @Header('Cache-Control', 'private, no-store')
  decide(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    return this.publish(request, id, null, body);
  }
  @Get('catalog/articles')
  @Header('Cache-Control', 'private, no-store')
  browse(@Req() request: Request) {
    const actor = this.requests.viewer(request, [
      'q',
      'category',
      'tag',
      'tags',
      'page',
      'pageSize',
      'sort',
    ]);
    return this.articles.browse(
      actor,
      articleRequest(() => parseArticleBrowseQuery(request.query))
    );
  }
  @Get('catalog/articles/:slug')
  @Header('Cache-Control', 'private, no-store')
  find(@Req() request: Request, @Param('slug') slug: string) {
    const actor = this.requests.viewer(request);
    return this.articles.find(
      actor,
      articleRequest(() => articleSlug(slug))
    );
  }
  @Get('catalog/article-selection')
  @Header('Cache-Control', 'private, no-store')
  select(@Req() request: Request) {
    const actor = this.requests.viewer(request, ['ids']);
    return this.articles.select(
      actor,
      articleRequest(() => parseArticleSelectionQuery(request.query))
    );
  }
  @Get('catalog/article-visibility/:id')
  @Header('Cache-Control', 'private, no-store')
  visibility(@Req() request: Request, @Param('id') id: string) {
    const actor = this.requests.viewer(request);
    return this.articles.visibility(
      actor,
      articleRequest(() => articleId(id))
    );
  }

  private draft(
    request: Request,
    action: ArticleDraftAction,
    id: string | null,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    return this.articles.draft(
      actor,
      action,
      id,
      body,
      this.requests.key(request)
    );
  }
  private publication(request: Request, id: string, review: boolean) {
    const actor = this.requests.actor(request);
    return this.articles.status(
      actor,
      articleRequest(() => articleId(id)),
      review
    );
  }
  private publish(
    request: Request,
    id: string,
    action: ArticlePublicationAction | null,
    body: unknown
  ) {
    const actor = this.requests.actor(request);
    const key = this.requests.key(request);
    const command = articleRequest(() => {
      let input = body;
      if (action === null) {
        const value = articleObject(body, [
          'decision',
          'expectedRevision',
          'expectedPublicationRevision',
          'submittedRevision',
          'reason',
        ]);
        if (value.decision !== 'approve' && value.decision !== 'reject')
          throw new Error('Invalid article decision');
        action = value.decision;
        input = {
          expectedRevision: value.expectedRevision,
          expectedPublicationRevision: value.expectedPublicationRevision,
          submittedRevision: value.submittedRevision,
          reason: value.reason,
        };
      }
      return {
        id: articleId(id),
        action,
        input: parseArticlePublicationInput(action, input),
      };
    });
    return this.articles.publish(
      actor,
      command.id,
      command.action,
      command.input,
      key
    );
  }
}
