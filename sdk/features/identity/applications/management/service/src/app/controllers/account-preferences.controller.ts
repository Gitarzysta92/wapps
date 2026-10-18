import { Body, Controller, Get, Header, Headers, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type IdentityManagementContext } from '@sdk/features/identity/libs/management';
import { AccountPreferencesService } from '@wapps/account';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { UpdatePreferencesRequestDto } from './dto/update-preferences.request.dto';

@ApiTags('me')
@Controller('me/preferences')
export class AccountPreferencesController {
  constructor(private readonly preferences: AccountPreferencesService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read my authoritative account preferences' })
  async read(@AuthUser() user: AuthenticatedUser) {
    const result = await this.preferences.read(this.context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Replace my account preferences with revision and idempotency checks',
  })
  async update(
    @AuthUser() user: AuthenticatedUser,
    @Body() body: UpdatePreferencesRequestDto,
    @Headers('idempotency-key') key: string
  ) {
    const result = await this.preferences.update(body, key, this.context(user));
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
