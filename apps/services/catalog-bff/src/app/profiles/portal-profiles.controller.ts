import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Header,
  HttpException,
  Param,
  Put,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  parseProfileFollowChange,
  parseProfileBadgeChange,
} from '@domains/customer/profiles';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalProfilesClient } from './portal-profiles.client';
import {
  profileCommand,
  profileId,
  profileQuery,
} from './portal-profiles.request';
import type { ProfileSection } from './portal-profiles.transport';

@Catch()
export class PortalProfilesErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Vary', 'Authorization');
    if (status === 429 || status === 503)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException
          ? error.message
          : 'Profile service unavailable',
    });
  }
}

@Controller('profiles')
@UseFilters(PortalProfilesErrorFilter)
export class PortalPublicProfilesController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly profiles: PortalProfilesClient
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  directory(@Req() request: Request) {
    const viewer = this.identities.readOptional(request);
    return this.profiles.directory(viewer, profileQuery(request, 'id'));
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  profile(@Req() request: Request, @Param('id') id: string) {
    const viewer = this.identities.readOptional(request);
    profileQuery(request);
    return this.profiles.profile(viewer, profileId(id));
  }

  @Get(':id/avatar/:avatarId')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async avatar(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('avatarId') avatarId: string,
    @Res() response: Response
  ) {
    const viewer = this.identities.readOptional(request);
    profileQuery(request);
    const bytes = await this.profiles.avatar(
      viewer,
      profileId(id),
      profileId(avatarId)
    );
    response.type('image/webp').send(bytes);
  }

  @Get(':id/totals')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  totals(@Req() request: Request, @Param('id') id: string) {
    const viewer = this.identities.readOptional(request);
    profileQuery(request);
    return this.profiles.totals(viewer, profileId(id));
  }

  @Get(':id/badges')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  badges(@Req() request: Request, @Param('id') id: string) {
    const viewer = this.identities.readOptional(request);
    profileQuery(request);
    return this.profiles.badges(viewer, profileId(id));
  }

  @Get(':id/favorites')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  favorites(@Req() request: Request, @Param('id') id: string) {
    return this.content(request, id, 'favorites');
  }

  @Get(':id/suites')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  suites(@Req() request: Request, @Param('id') id: string) {
    return this.content(request, id, 'suites');
  }

  @Get(':id/articles')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  articles(@Req() request: Request, @Param('id') id: string) {
    return this.content(request, id, 'articles');
  }

  @Get(':id/discussions')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  discussions(@Req() request: Request, @Param('id') id: string) {
    return this.content(request, id, 'discussions');
  }

  @Get(':id/activity')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  activity(@Req() request: Request, @Param('id') id: string) {
    return this.content(request, id, 'activity');
  }

  private content(request: Request, id: string, section: ProfileSection) {
    const viewer = this.identities.readOptional(request);
    return this.profiles.content(
      viewer,
      profileId(id),
      section,
      profileQuery(
        request,
        section === 'suites' || section === 'articles' ? 'id' : section
      )
    );
  }
}

@Controller('me')
@UseFilters(PortalProfilesErrorFilter)
export class PortalProfileRelationsController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly profiles: PortalProfilesClient
  ) {}

  @Get('profile-follows')
  @Header('Cache-Control', 'private, no-store')
  followers(@Req() request: Request) {
    const actor = this.identities.read(request);
    return this.profiles.follows(actor, false, profileQuery(request, 'id'));
  }

  @Get('profile-follows/outgoing')
  @Header('Cache-Control', 'private, no-store')
  following(@Req() request: Request) {
    const actor = this.identities.read(request);
    return this.profiles.follows(actor, true, profileQuery(request, 'id'));
  }

  @Put('profile-follows')
  @Header('Cache-Control', 'private, no-store')
  follow(@Req() request: Request, @Body() body: unknown) {
    const actor = this.identities.read(request);
    const { input, key } = profileCommand(
      request,
      body,
      parseProfileFollowChange
    );
    return this.profiles.follow(actor, input, key);
  }

  @Get('totals')
  @Header('Cache-Control', 'private, no-store')
  totals(@Req() request: Request) {
    const actor = this.identities.read(request);
    profileQuery(request);
    return this.profiles.totals(actor, null);
  }

  @Get('badges')
  @Header('Cache-Control', 'private, no-store')
  badges(@Req() request: Request) {
    const actor = this.identities.read(request);
    profileQuery(request);
    return this.profiles.badges(actor, null);
  }
}

@Controller('admin/profile-badges')
@UseFilters(PortalProfilesErrorFilter)
export class PortalProfileBadgeController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly profiles: PortalProfilesClient
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  capabilities(@Req() request: Request) {
    const actor = this.identities.read(request);
    profileQuery(request);
    return this.profiles.badgeCapabilities(actor);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  history(@Req() request: Request, @Param('id') id: string) {
    const actor = this.identities.read(request);
    return this.profiles.badgeHistory(
      actor,
      profileId(id),
      profileQuery(request, 'history')
    );
  }

  @Put(':id')
  @Header('Cache-Control', 'private, no-store')
  change(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: unknown
  ) {
    const actor = this.identities.read(request);
    const target = profileId(id);
    const { input, key } = profileCommand(
      request,
      body,
      parseProfileBadgeChange,
      /^[A-Za-z0-9._:-]{1,128}$/
    );
    return this.profiles.changeBadge(actor, target, input, key);
  }
}
