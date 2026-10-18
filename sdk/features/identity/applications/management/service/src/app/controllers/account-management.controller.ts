import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ForbiddenException,
  HttpCode,
  Header,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { isErr } from '@sdk/kernel/standard';
import { AuthUser, AuthenticatedUser } from '../decorators/auth-user.decorator';
import { AccountManagementAppService } from '../services/account-management-app.service';
import { UpdateEmailRequestDto } from './dto/update-email.request.dto';
import { UpdatePasswordRequestDto } from './dto/update-password.request.dto';
import { UnlinkProvidersRequestDto } from './dto/unlink-providers.request.dto';
import { GenerateLinkRequestDto } from './dto/generate-link.request.dto';

@ApiTags('admin')
@Controller('admin/users')
export class AccountManagementController {
  constructor(private readonly svc: AccountManagementAppService) {}

  private ensureOk<T>(
    r: { ok: true; value: T } | { ok: false; error: Error }
  ): T {
    if (isErr(r)) {
      if (r.error.message.startsWith('Forbidden:')) {
        throw new ForbiddenException(r.error.message);
      }
      throw r.error;
    }
    return r.value;
  }

  @Post(':uid/disable')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Disable user account' })
  @ApiParam({ name: 'uid', description: 'Stable application identity ID' })
  async disable(
    @Param('uid') uid: string,
    @AuthUser() user: AuthenticatedUser
  ) {
    const r = await this.svc.disableUser(uid, user);
    return { disabled: this.ensureOk(r) };
  }

  @Post(':uid/enable')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Enable user account' })
  async enable(@Param('uid') uid: string, @AuthUser() user: AuthenticatedUser) {
    const r = await this.svc.enableUser(uid, user);
    return { enabled: this.ensureOk(r) };
  }

  @Post(':uid/revoke-tokens')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Revoke refresh tokens (logout everywhere)' })
  async revokeTokens(
    @Param('uid') uid: string,
    @AuthUser() user: AuthenticatedUser
  ) {
    const r = await this.svc.revokeTokens(uid, user);
    return { revoked: this.ensureOk(r) };
  }

  @Delete(':uid')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Tombstone user account and schedule credential cleanup',
  })
  async delete(@Param('uid') uid: string, @AuthUser() user: AuthenticatedUser) {
    const r = await this.svc.deleteUser(uid, user);
    return this.ensureOk(r);
  }

  @Patch(':uid/email')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Update user email' })
  async updateEmail(
    @Param('uid') uid: string,
    @Body() body: UpdateEmailRequestDto,
    @AuthUser() user: AuthenticatedUser
  ) {
    const r = await this.svc.updateEmail(uid, body.email, user);
    return { updated: this.ensureOk(r) };
  }

  @Patch(':uid/password')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Update user password' })
  async updatePassword(
    @Param('uid') uid: string,
    @Body() body: UpdatePasswordRequestDto,
    @AuthUser() user: AuthenticatedUser
  ) {
    const r = await this.svc.updatePassword(uid, body.password, user);
    return { updated: this.ensureOk(r) };
  }

  @Post(':uid/unlink-providers')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Unlink providers from user account' })
  async unlinkProviders(
    @Param('uid') uid: string,
    @Body() body: UnlinkProvidersRequestDto,
    @AuthUser() user: AuthenticatedUser
  ) {
    const r = await this.svc.unlinkProviders(uid, body.providersToUnlink, user);
    return { updated: this.ensureOk(r) };
  }

  @Post(':uid/generate-password-reset-link')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Generate password reset link for email' })
  async generatePasswordResetLink(
    @Param('uid') uid: string,
    @Body() body: GenerateLinkRequestDto,
    @AuthUser() user: AuthenticatedUser
  ) {
    const r = await this.svc.generatePasswordResetLink(uid, body.email, user);
    return { link: this.ensureOk(r) };
  }

  @Post(':uid/generate-email-verification-link')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Generate email verification link for email' })
  async generateEmailVerificationLink(
    @Param('uid') uid: string,
    @Body() body: GenerateLinkRequestDto,
    @AuthUser() user: AuthenticatedUser
  ) {
    const r = await this.svc.generateEmailVerificationLink(
      uid,
      body.email,
      user
    );
    return { link: this.ensureOk(r) };
  }

  @Get(':uid/identity')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary: 'Get canonical application identity',
  })
  async getIdentityMapping(
    @Param('uid') uid: string,
    @AuthUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    const r = await this.svc.getIdentityMapping(uid, user);
    response.json(this.ensureOk(r));
  }

  @Get(':uid/deletion-status')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      'Read credential and account erasure completion without changing state',
  })
  async deletionStatus(
    @Param('uid') uid: string,
    @AuthUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    response.json(this.ensureOk(await this.svc.getDeletionStatus(uid, user)));
  }
}
