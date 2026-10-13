import { Body, Controller, Get, Header, Headers, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PrivateProfileService,
  type IdentityManagementContext,
} from '@sdk/features/identity/libs/management';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
import { UpdateProfileRequestDto } from './dto/update-profile.request.dto';

@ApiTags('me')
@Controller('me/profile')
export class PrivateProfileController {
  constructor(private readonly profiles: PrivateProfileService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read my authoritative private profile' })
  async read(@AuthUser() user: AuthenticatedUser) {
    const result = await this.profiles.read(this.context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Replace my profile text with revision and idempotency checks',
  })
  async update(
    @AuthUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileRequestDto,
    @Headers('idempotency-key') key: string
  ) {
    const result = await this.profiles.update(body, key, this.context(user));
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
