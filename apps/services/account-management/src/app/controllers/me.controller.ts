import { Controller, Delete, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';
import { PublicAccountAppService } from '../services/public-account-app.service';

@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(private readonly svc: PublicAccountAppService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user (ensures internal stubs exist)' })
  async getMe(@AuthUser() user: AuthenticatedUser) {
    return await this.svc.ensureMe(user.userId, { email: user.userEmail });
  }

  @Delete()
  @ApiOperation({ summary: 'Delete my account (best effort)' })
  async deleteMe(@AuthUser() user: AuthenticatedUser) {
    const r = await this.svc.deleteMe(user.userId);
    return r.ok ? r.value : { deleted: false };
  }
}

