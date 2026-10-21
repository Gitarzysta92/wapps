import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { articleObject } from '@domains/publication/article';
import { EditorialUser } from '../http/editorial-auth';
import type { EditorialActor } from '../application/editorial.ports';
import { ProfileArticles } from './profile-articles';

@Controller('internal/profile-articles')
export class ProfileArticlesController {
  constructor(private readonly articles: ProfileArticles) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  read(
    @Body() body: unknown,
    @Query() query: unknown,
    @EditorialUser() actor: EditorialActor
  ) {
    articleObject(query, []);
    return this.articles.read(body, actor);
  }
}
