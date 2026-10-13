import { Body, Controller, Get, Header, Headers, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AccountFavoritesService,
  type IdentityManagementContext,
} from '@sdk/features/identity/libs/management';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { ChangeFavoriteRequestDto } from './dto/change-favorite.request.dto';

@ApiTags('me')
@Controller('me/favorites')
export class AccountFavoritesController {
  constructor(private readonly favorites: AccountFavoritesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read my canonical saved target references' })
  async read(@AuthUser() user: AuthenticatedUser) {
    const result = await this.favorites.read(this.context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Save or remove one canonical favorite with revision and idempotency checks',
  })
  async change(
    @AuthUser() user: AuthenticatedUser,
    @Body() input: ChangeFavoriteRequestDto,
    @Headers('idempotency-key') key: string
  ) {
    const result = await this.favorites.change(input, key, this.context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }

  private context(user: AuthenticatedUser): IdentityManagementContext {
    const roles = user.userClaims?.roles;
    return {
      identityId: user.userId,
      timestamp: Date.now(),
      subject: { roles: Array.isArray(roles) ? roles : [] },
    };
  }
}
