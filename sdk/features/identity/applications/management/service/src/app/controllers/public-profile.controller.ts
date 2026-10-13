import { PublicProfileArticlesQueryDto } from './dto/public-profile-articles.query.dto';
import { PublicProfileArticlesService } from '@sdk/features/identity/libs/management';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { PublicProfileFavoritesQueryDto } from './dto/public-profile-favorites.query.dto';
import { PublicProfileSuitesQueryDto } from './dto/public-profile-suites.query.dto';
import { PublicProfileDiscussionsQueryDto } from './dto/public-profile-discussions.query.dto';
import { PublicProfileActivityQueryDto } from './dto/public-profile-activity.query.dto';
import {
  PublicProfileService,
  PublicProfileFavoritesService,
  PublicProfileSuitesService,
  PublicProfileDiscussionsService,
  PublicProfileActivityService,
} from '@sdk/features/identity/libs/management';
import {
  AuthUser,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';

@Controller('profiles')
export class PublicProfileController {
  constructor(
    private readonly profiles: PublicProfileService,
    private readonly favorites: PublicProfileFavoritesService,
    private readonly suites: PublicProfileSuitesService,
    private readonly articles: PublicProfileArticlesService,
    private readonly discussions: PublicProfileDiscussionsService,
    private readonly activity: PublicProfileActivityService
  ) {}

  @Get(':id/activity')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async sharedActivity(
    @Param('id') id: string,
    @Query() query: PublicProfileActivityQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.activity.read(
      id,
      request.authUser?.userId ?? null,
      query.after ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get(':id/discussions')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async sharedDiscussions(
    @Param('id') id: string,
    @Query() query: PublicProfileDiscussionsQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.discussions.read(
      id,
      request.authUser?.userId ?? null,
      query.after ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get(':id/articles')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async sharedArticles(
    @Param('id') id: string,
    @Query() query: PublicProfileArticlesQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.articles.read(
      id,
      request.authUser?.userId ?? null,
      query.after ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get(':id/suites')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async sharedSuites(
    @Param('id') id: string,
    @Query() query: PublicProfileSuitesQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.suites.read(
      id,
      request.authUser?.userId ?? null,
      query.after ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get(':id/favorites')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async sharedFavorites(
    @Param('id') id: string,
    @Query() query: PublicProfileFavoritesQueryDto,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.favorites.read(
      id,
      request.authUser?.userId ?? null,
      query.after ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async directory(
    @Query('after') after: string | undefined,
    @Req() request: AuthenticatedRequest
  ) {
    const result = await this.profiles.directory(
      after ?? null,
      request.authUser?.userId ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  async read(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    const result = await this.profiles.read(
      id,
      request.authUser?.userId ?? null
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get(':id/avatar/:avatarId')
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  @Header('X-Content-Type-Options', 'nosniff')
  async avatar(
    @Param('id') id: string,
    @Param('avatarId') avatarId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const result = await this.profiles.avatar(
      id,
      avatarId,
      request.authUser?.userId ?? null
    );
    if (!result.ok) throw result.error;
    response.type('image/webp').send(Buffer.from(result.value.bytes));
  }
}

@Controller('me/profile-follows')
export class ProfileFollowsController {
  constructor(private readonly profiles: PublicProfileService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @AuthUser() user: AuthenticatedUser,
    @Query('after') after: string | undefined
  ) {
    const result = await this.profiles.followers(
      after ?? null,
      this.context(user)
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get('outgoing')
  @Header('Cache-Control', 'no-store')
  async outgoing(
    @AuthUser() user: AuthenticatedUser,
    @Query('after') after: string | undefined
  ) {
    const result = await this.profiles.following(
      after ?? null,
      this.context(user)
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  async change(
    @AuthUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string
  ) {
    const result = await this.profiles.changeFollow(
      body,
      key,
      this.context(user)
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  private context(user: AuthenticatedUser) {
    const roles = user.userClaims?.roles;
    return {
      identityId: user.userId,
      timestamp: Date.now(),
      subject: { roles: Array.isArray(roles) ? roles : [] },
    };
  }
}
