import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { exploreObject } from '@domains/feed';
import type { EditorialActor } from '../application/editorial.ports';
import { ExplorePublications } from '../application/explore-publications';
import { EditorialUser } from './editorial-auth';

@Controller('internal/explore')
export class ExploreController {
  constructor(private readonly explore: ExplorePublications) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  read(
    @Body() body: unknown,
    @Query() query: unknown,
    @EditorialUser() actor: EditorialActor
  ) {
    exploreObject(query, []);
    return this.explore.read(body, actor);
  }
}
