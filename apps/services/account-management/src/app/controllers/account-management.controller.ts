import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { isErr } from '@foundation/standard';
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

  private ensureOk<T>(r: { ok: true; value: T } | { ok: false; error: Error }): T {
    if (isErr(r)) {
      if (r.error.message.startsWith('Forbidden:')) {
        throw new ForbiddenException(r.error.message);
      }
      throw new BadRequestException(r.error.message);
    }
    return r.value;
  }

  @Post(':uid/disable')
  @ApiOperation({ summary: 'Disable user account' })
  @ApiParam({ name: 'uid', description: 'Target Firebase uid' })
  async disable(@Param('uid') uid: string, @AuthUser() user: AuthenticatedUser) {
    const r = await this.svc.disableUser(uid, user);
    return { disabled: this.ensureOk(r) };
  }

  @Post(':uid/enable')
  @ApiOperation({ summary: 'Enable user account' })
  async enable(@Param('uid') uid: string, @AuthUser() user: AuthenticatedUser) {
    const r = await this.svc.enableUser(uid, user);
    return { enabled: this.ensureOk(r) };
  }

  @Post(':uid/revoke-tokens')
  @ApiOperation({ summary: 'Revoke refresh tokens (logout everywhere)' })
  async revokeTokens(@Param('uid') uid: string, @AuthUser() user: AuthenticatedUser) {
    const r = await this.svc.revokeTokens(uid, user);
    return { revoked: this.ensureOk(r) };
  }

  @Delete(':uid')
  @ApiOperation({ summary: 'Delete user account' })
  async delete(@Param('uid') uid: string, @AuthUser() user: AuthenticatedUser) {
    const r = await this.svc.deleteUser(uid, user);
    return { deleted: this.ensureOk(r) };
  }

  @Patch(':uid/email')
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
  @ApiOperation({ summary: 'Generate email verification link for email' })
  async generateEmailVerificationLink(
    @Param('uid') uid: string,
    @Body() body: GenerateLinkRequestDto,
    @AuthUser() user: AuthenticatedUser
  ) {
    const r = await this.svc.generateEmailVerificationLink(uid, body.email, user);
    return { link: this.ensureOk(r) };
  }

  @Get(':uid/identity')
  @ApiOperation({ summary: 'Get identity graph mapping for Firebase uid' })
  async getIdentityMapping(@Param('uid') uid: string, @AuthUser() user: AuthenticatedUser) {
    const r = await this.svc.getIdentityMapping(uid, user);
    return this.ensureOk(r);
  }
}

