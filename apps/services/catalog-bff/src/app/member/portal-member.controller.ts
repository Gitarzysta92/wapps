import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Header,
  HttpException,
  Put,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  parseFavoriteChange,
  favoriteUpdateCursor,
  favoriteUpdateId,
  favoriteUpdateObject,
} from '@domains/customer/favorites';
import { replyInboxCursor, mentionInboxCursor } from '@domains/community';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';
import { PortalMemberClient, type InboxKind } from './portal-member.client';
import { PortalFavoriteContentService } from './portal-favorite-content.service';

@Catch()
export class PortalMemberErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    if (status === 503 || status === 429)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException
          ? error.message
          : 'Favorites or notifications unavailable',
    });
  }
}

@Controller('me')
@UseFilters(PortalMemberErrorFilter)
export class PortalMemberController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly member: PortalMemberClient,
    private readonly content: PortalFavoriteContentService
  ) {}
  @Get('favorites')
  @Header('Cache-Control', 'private, no-store')
  favorites(@Req() request: Request) {
    const actor = this.identities.read(request);
    this.noReadBody(request);
    this.noQuery(request);
    return this.member.favorites(actor);
  }
  @Get('favorites/content')
  @Header('Cache-Control', 'private, no-store')
  favoriteContent(@Req() request: Request) {
    const actor = this.identities.read(request);
    this.noReadBody(request);
    this.noQuery(request);
    return this.content.read(actor);
  }
  @Put('favorites')
  @Header('Cache-Control', 'private, no-store')
  changeFavorite(@Req() request: Request, @Body() body: unknown) {
    const actor = this.identities.read(request);
    this.noReadBody(request);
    this.noQuery(request);
    const key = singleHeader(request, 'idempotency-key', 128);
    if (!key || !/^[\x21-\x7e]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    let input;
    try {
      input = parseFavoriteChange(body);
    } catch {
      throw new BadRequestException('Invalid favorite change');
    }
    return this.member.change(actor, input, key);
  }
  @Get('notifications')
  @Header('Cache-Control', 'private, no-store')
  replies(@Req() request: Request) {
    return this.list(request, 'replies');
  }
  @Get('notifications/mentions')
  @Header('Cache-Control', 'private, no-store')
  mentions(@Req() request: Request) {
    return this.list(request, 'mentions');
  }
  @Get('notifications/favorites')
  @Header('Cache-Control', 'private, no-store')
  updates(@Req() request: Request) {
    return this.list(request, 'favorites');
  }
  @Put('notifications/read')
  @Header('Cache-Control', 'private, no-store')
  readReply(@Req() request: Request, @Body() body: unknown) {
    return this.markRead(request, 'replies', body);
  }
  @Put('notifications/mentions/read')
  @Header('Cache-Control', 'private, no-store')
  readMention(@Req() request: Request, @Body() body: unknown) {
    return this.markRead(request, 'mentions', body);
  }
  @Put('notifications/favorites/read')
  @Header('Cache-Control', 'private, no-store')
  readUpdate(@Req() request: Request, @Body() body: unknown) {
    return this.markRead(request, 'favorites', body);
  }
  private list(request: Request, kind: InboxKind) {
    const actor = this.identities.read(request);
    this.noReadBody(request);
    let cursor;
    try {
      if (Object.keys(request.query).some((key) => key !== 'cursor'))
        throw new Error('Invalid query');
      const parsed = (
        kind === 'favorites'
          ? favoriteUpdateCursor
          : kind === 'mentions'
          ? mentionInboxCursor
          : replyInboxCursor
      )(request.query['cursor']);
      cursor = parsed ? `${parsed.at}.${parsed.id}` : undefined;
    } catch {
      throw new BadRequestException('Invalid notification cursor');
    }
    return this.member.inbox(actor, kind, cursor);
  }
  private markRead(request: Request, kind: InboxKind, body: unknown) {
    const actor = this.identities.read(request);
    this.noReadBody(request);
    this.noQuery(request);
    let id;
    try {
      id = favoriteUpdateId(favoriteUpdateObject(body, ['id'])['id']);
    } catch {
      throw new BadRequestException('Invalid notification ID');
    }
    return this.member.markRead(actor, kind, id);
  }
  private noReadBody(request: Request) {
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      (request.headers['transfer-encoding'] !== undefined ||
        (request.headers['content-length'] !== undefined &&
          request.headers['content-length'] !== '0'))
    )
      throw new BadRequestException('Account reads do not accept a body');
  }
  private noQuery(request: Request) {
    if (Object.keys(request.query).length)
      throw new BadRequestException(
        'This account route does not accept query parameters'
      );
  }
}
