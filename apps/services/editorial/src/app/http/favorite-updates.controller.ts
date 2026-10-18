import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpException,
  Post,
  Query,
} from '@nestjs/common';
import { FavoritesContractError } from '@domains/customer/favorites';
import { PermissionDeniedError } from '@sdk/kernel/ontology/authority';
import { FavoriteUpdateSourceAccess } from '@wapps/account';
import { EditorialUser } from './editorial-auth';
import type { EditorialActor } from '../application/editorial.ports';

@Controller('internal/favorite-updates')
export class FavoriteUpdateSourceController {
  constructor(private readonly access: FavoriteUpdateSourceAccess) {}
  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  async read(
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @EditorialUser() actor: EditorialActor
  ) {
    try {
      if (Object.keys(query).length)
        throw new FavoritesContractError('Unexpected update query');
      return await this.access.read(body, actor);
    } catch (error) {
      const status =
        error instanceof PermissionDeniedError
          ? 403
          : error instanceof FavoritesContractError
          ? 400
          : 503;
      throw new HttpException(
        status === 503
          ? 'Favorite update source unavailable'
          : status === 403
          ? 'Favorite update access denied'
          : 'Invalid favorite update request',
        status
      );
    }
  }
}
