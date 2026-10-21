import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isCanonicalIdentityId } from '@sdk/features/identity/core';
import { TrustedPortalIdentityReader } from '../identity/trusted-portal-identity';
import { PortalAccountErrorFilter } from './portal-account.controller';
import { PortalAccountAdminClient } from './portal-account-admin.client';
import {
  AccountAdminAction,
  accountAdminInput,
} from './portal-account-admin.contracts';

@Controller('admin/users')
@UseFilters(PortalAccountErrorFilter)
export class PortalAccountAdminController {
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly account: PortalAccountAdminClient
  ) {}

  @Post(':uid/disable')
  @Header('Cache-Control', 'private, no-store')
  disable(@Req() request: Request, @Param('uid') uid: string) {
    return this.change(request, uid, 'disable');
  }

  @Post(':uid/enable')
  @Header('Cache-Control', 'private, no-store')
  enable(@Req() request: Request, @Param('uid') uid: string) {
    return this.change(request, uid, 'enable');
  }

  @Post(':uid/revoke-tokens')
  @Header('Cache-Control', 'private, no-store')
  revoke(@Req() request: Request, @Param('uid') uid: string) {
    return this.change(request, uid, 'revoke-tokens');
  }

  @Delete(':uid')
  @HttpCode(202)
  @Header('Cache-Control', 'private, no-store')
  delete(@Req() request: Request, @Param('uid') uid: string) {
    return this.change(request, uid, 'delete');
  }

  @Patch(':uid/email')
  @Header('Cache-Control', 'private, no-store')
  email(
    @Req() request: Request,
    @Param('uid') uid: string,
    @Body() body: unknown
  ) {
    return this.change(request, uid, 'email', body, true);
  }

  @Patch(':uid/password')
  @Header('Cache-Control', 'private, no-store')
  password(
    @Req() request: Request,
    @Param('uid') uid: string,
    @Body() body: unknown
  ) {
    return this.change(request, uid, 'password', body, true);
  }

  @Post(':uid/unlink-providers')
  @Header('Cache-Control', 'private, no-store')
  unlink(
    @Req() request: Request,
    @Param('uid') uid: string,
    @Body() body: unknown
  ) {
    return this.change(request, uid, 'unlink-providers', body, true);
  }

  @Post(':uid/generate-password-reset-link')
  @Header('Cache-Control', 'private, no-store')
  passwordReset(
    @Req() request: Request,
    @Param('uid') uid: string,
    @Body() body: unknown
  ) {
    return this.change(
      request,
      uid,
      'generate-password-reset-link',
      body,
      true
    );
  }

  @Post(':uid/generate-email-verification-link')
  @Header('Cache-Control', 'private, no-store')
  verification(
    @Req() request: Request,
    @Param('uid') uid: string,
    @Body() body: unknown
  ) {
    return this.change(
      request,
      uid,
      'generate-email-verification-link',
      body,
      true
    );
  }

  @Get(':uid/identity')
  @Header('Cache-Control', 'private, no-store')
  async identity(
    @Req() request: Request,
    @Param('uid') uid: string,
    @Res() response: Response
  ) {
    response.json(await this.change(request, uid, 'identity'));
  }

  @Get(':uid/deletion-status')
  @Header('Cache-Control', 'private, no-store')
  async deletionStatus(
    @Req() request: Request,
    @Param('uid') uid: string,
    @Res() response: Response
  ) {
    response.json(await this.change(request, uid, 'deletion-status'));
  }

  private change(
    request: Request,
    uid: string,
    action: AccountAdminAction,
    body?: unknown,
    acceptsBody = false
  ) {
    const actor = this.identities.read(request);
    if (
      !isCanonicalIdentityId(uid) ||
      /[\u002f\\?#%]/.test(uid) ||
      uid === '.' ||
      uid === '..'
    )
      throw new BadRequestException('Invalid target identity');
    if (
      Object.keys(request.query).length ||
      (!acceptsBody &&
        (request.headers['transfer-encoding'] !== undefined ||
          (request.headers['content-length'] !== undefined &&
            request.headers['content-length'] !== '0')))
    )
      throw new BadRequestException(
        'This command accepts no body or query parameters'
      );
    let input;
    if (acceptsBody) {
      try {
        input = accountAdminInput(action, body);
      } catch {
        throw new BadRequestException('Invalid account administration body');
      }
    }
    return this.account.change(actor, uid, action, input);
  }
}
