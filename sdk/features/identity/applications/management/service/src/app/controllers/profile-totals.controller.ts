import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ProfileTotalsService } from '@sdk/features/identity/libs/management';
import {
  AuthUser,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';
function queryOnly(query: Record<string, unknown>) {
  if (Object.keys(query).length)
    throw new BadRequestException('Unexpected totals query');
}
@Controller('me/totals')
export class MyProfileTotalsController {
  constructor(private readonly totals: ProfileTotalsService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async read(
    @AuthUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>
  ) {
    queryOnly(query);
    const roles = user.userClaims?.roles;
    const result = await this.totals.own({
      identityId: user.userId,
      timestamp: Date.now(),
      subject: { roles: Array.isArray(roles) ? roles : [] },
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
}
@Controller('profiles/:id/totals')
export class PublicProfileTotalsController {
  constructor(private readonly totals: ProfileTotalsService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async read(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>
  ) {
    queryOnly(query);
    const result = await this.totals.shared(
      id,
      request.authUser?.userId ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }
}
