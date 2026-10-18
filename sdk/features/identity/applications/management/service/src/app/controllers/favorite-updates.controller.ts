import { Body, Controller, Get, Header, Put, Query } from '@nestjs/common';
import { CanonicalIdentityInputError } from '@sdk/features/identity/core';
import { type IdentityManagementContext } from '@sdk/features/identity/libs/management';
import { FavoriteUpdatesService } from '@wapps/account';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';

@Controller('me/notifications/favorites')
export class FavoriteUpdatesController {
  constructor(private readonly inbox: FavoriteUpdatesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@AuthUser() user: AuthenticatedUser, @Query() query: unknown) {
    const result = await this.inbox.list(query, this.context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Put('read')
  @Header('Cache-Control', 'no-store')
  async markRead(
    @AuthUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>
  ) {
    if (Object.keys(query).length)
      throw new CanonicalIdentityInputError(
        'Notification updates do not accept query fields'
      );
    const result = await this.inbox.markRead(body, this.context(user));
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
