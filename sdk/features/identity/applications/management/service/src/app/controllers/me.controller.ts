import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';
import { PublicAccountAppService } from '../services/public-account-app.service';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(private readonly svc: PublicAccountAppService) {}

  @Get()
  @ApiOperation({ summary: 'Get current canonical identity and account' })
  async getMe(@AuthUser() user: AuthenticatedUser) {
    return await this.svc.ensureMe(user.userId, { email: user.userEmail });
  }

  @Delete()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Tombstone my account and schedule credential cleanup',
  })
  async deleteMe(@AuthUser() user: AuthenticatedUser) {
    return this.svc.deleteMe(user.userId);
  }
}
