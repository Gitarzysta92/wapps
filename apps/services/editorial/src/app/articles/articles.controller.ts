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
} from '@nestjs/common';
import {
  articleObject,
  articlePageNumber,
  parseArticleBrowseQuery,
  parseArticleSelectionQuery,
  ArticleInputError,
} from '@domains/publication/article';
import type { EditorialActor } from '../application/editorial.ports';
import { EditorialUser } from '../http/editorial-auth';
import { ArticleWorkspace } from './article-workspace';
import { ArticleCatalog } from './article-catalog';

@Controller('me/articles')
export class ArticlesController {
  constructor(private readonly workspace: ArticleWorkspace) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor) {
    return this.workspace.list(actor);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.workspace.read(actor, id);
  }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @EditorialUser() actor: EditorialActor,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.change(actor, 'create', null, body, key);
  }
  @Put(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.change(actor, 'update', id, body, key);
  }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  remove(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.change(actor, 'delete', id, body, key);
  }
  @Get(':id/publication')
  @Header('Cache-Control', 'no-store')
  status(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.workspace.status(actor, id);
  }
  @Post(':id/submit')
  @Header('Cache-Control', 'no-store')
  submit(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.publish(actor, id, 'submit', body, key);
  }
  @Post(':id/withdraw')
  @Header('Cache-Control', 'no-store')
  withdraw(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    return this.workspace.publish(actor, id, 'withdraw', body, key);
  }
}
@Controller('editorial/article-reviews')
export class ArticleReviewsController {
  constructor(private readonly workspace: ArticleWorkspace) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@EditorialUser() actor: EditorialActor, @Query() query: unknown) {
    return this.workspace.reviews(
      actor,
      articlePageNumber(articleObject(query, ['page'])['page'])
    );
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  read(@EditorialUser() actor: EditorialActor, @Param('id') id: string) {
    return this.workspace.status(actor, id, true);
  }
  @Post(':id/decision')
  @Header('Cache-Control', 'no-store')
  decide(
    @EditorialUser() actor: EditorialActor,
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const value = articleObject(body, [
      'decision',
      'expectedRevision',
      'expectedPublicationRevision',
      'submittedRevision',
      'reason',
    ]);
    if (value['decision'] !== 'approve' && value['decision'] !== 'reject')
      throw new ArticleInputError('Invalid article decision');
    return this.workspace.publish(
      actor,
      id,
      value['decision'],
      {
        expectedRevision: value['expectedRevision'],
        expectedPublicationRevision: value['expectedPublicationRevision'],
        submittedRevision: value['submittedRevision'],
        reason: value['reason'],
      },
      key
    );
  }
}
@Controller('catalog')
export class ArticleCatalogController {
  constructor(private readonly catalog: ArticleCatalog) {}
  @Get('article-visibility/:id')
  @Header('Cache-Control', 'no-store')
  visibility(@Param('id') id: string) {
    return this.catalog.visibility(id);
  }
  @Get('articles')
  @Header('Cache-Control', 'no-store')
  browse(@Query() query: unknown) {
    return this.catalog.browse(parseArticleBrowseQuery(query));
  }
  @Get('article-selection')
  @Header('Cache-Control', 'no-store')
  select(@Query() query: unknown) {
    return this.catalog.select(parseArticleSelectionQuery(query));
  }
  @Get('articles/:slug')
  @Header('Cache-Control', 'no-store')
  read(@Param('slug') slug: string) {
    return this.catalog.find(slug);
  }
}
