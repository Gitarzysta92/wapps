import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { type IdentityManagementContext } from '@sdk/features/identity/libs/management';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import { ProfileBadgesService } from '@wapps/account';
import {
  AuthUser,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';

function context(user: AuthenticatedUser): IdentityManagementContext {
  const roles = user.userClaims?.roles;
  const tenantId = user.userClaims?.tenantId;
  if (tenantId !== undefined && !isCanonicalIdentityId(tenantId))
    throw new BadRequestException('Invalid badge actor tenant');
  return {
    identityId: user.userId,
    ...(tenantId === undefined ? {} : { tenantId }),
    timestamp: Date.now(),
    subject: { roles: Array.isArray(roles) ? roles : [] },
  };
}
function cursor(query: Record<string, unknown>, paged = false): number | null {
  if (Object.keys(query).some((key) => !paged || key !== 'after'))
    throw new BadRequestException('Unexpected badge query');
  const after = query['after'];
  if (after === undefined) return null;
  if (
    typeof after !== 'string' ||
    !/^[1-9][0-9]{0,15}$/.test(after) ||
    !Number.isSafeInteger(Number(after))
  )
    throw new BadRequestException('Invalid badge history cursor');
  return Number(after);
}

@Controller('admin/profile-badges')
export class ProfileBadgeAdministrationController {
  constructor(private readonly badges: ProfileBadgesService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async capabilities(
    @AuthUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>
  ) {
    cursor(query);
    const result = await this.badges.capabilities(context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  async read(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @AuthUser() user: AuthenticatedUser
  ) {
    const result = await this.badges.administer(
      id,
      cursor(query, true),
      context(user)
    );
    if (!result.ok) throw result.error;
    return result.value;
  }
  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  async change(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
    @Query() query: Record<string, unknown>,
    @AuthUser() user: AuthenticatedUser
  ) {
    cursor(query);
    const result = await this.badges.change(id, body, key, context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }
}
@Controller('me/badges')
export class MyProfileBadgesController {
  constructor(private readonly badges: ProfileBadgesService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async read(
    @AuthUser() user: AuthenticatedUser,
    @Query() query: Record<string, unknown>
  ) {
    cursor(query);
    const result = await this.badges.own(context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }
}
@Controller('profiles/:id/badges')
export class PublicProfileBadgesController {
  constructor(private readonly badges: ProfileBadgesService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async read(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest
  ) {
    cursor(query);
    const result = await this.badges.shared(
      id,
      request.authUser?.userId ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }
}
