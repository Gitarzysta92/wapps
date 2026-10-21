import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  PayloadTooLargeException,
  Put,
  Req,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { raw, type Request, type Response } from 'express';
import { PROFILE_AVATAR_SOURCE_LIMIT } from '@domains/customer/profiles';
import { CanonicalIdentityUnavailable } from '@sdk/features/identity/core';
import { type IdentityManagementContext } from '@sdk/features/identity/libs/management';
import { ProfileAvatarService } from '@wapps/account';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';

@ApiTags('me')
@Controller('me/profile/avatar')
export class ProfileAvatarController {
  private active = 0;
  constructor(private readonly avatars: ProfileAvatarService) {}

  @Put()
  @Header('Cache-Control', 'no-store')
  async upload(
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string,
    @Headers('if-match') match: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(
        String(request.headers['content-type'])
      ) ||
      (request.headers['content-encoding'] !== undefined &&
        request.headers['content-encoding'] !== 'identity')
    )
      throw new UnsupportedMediaTypeException(
        'Send uncompressed PNG, JPEG or WebP bytes'
      );
    const byteCount = request.headers['x-avatar-bytes'];
    if (typeof byteCount !== 'string' || !/^[1-9][0-9]{0,6}$/.test(byteCount))
      throw new BadRequestException('Invalid photo size');
    const input = {
      expectedRevision: this.revision(match),
      source: {
        contentType: request.headers['content-type'],
        bytes: Number(byteCount),
        sha256: request.headers['x-avatar-sha256'],
      },
    };
    const context = this.context(user);
    const check = await this.avatars.inspect(input, key, context);
    if (!check.ok) throw check.error;
    if (check.value) return check.value;
    if (this.active >= 2)
      throw new CanonicalIdentityUnavailable('Photo uploads are busy');
    this.active++;
    try {
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => request.destroy(), 15_000);
        raw({
          type: () => true,
          limit: PROFILE_AVATAR_SOURCE_LIMIT,
          inflate: false,
        })(request, response, (error: unknown) => {
          clearTimeout(deadline);
          if (!error) return resolve();
          reject(
            typeof error === 'object' &&
              error !== null &&
              'status' in error &&
              error.status === 413
              ? new PayloadTooLargeException('Photo exceeds 2 MiB')
              : new BadRequestException('Invalid photo body')
          );
        });
      });
      if (!Buffer.isBuffer(request.body))
        throw new BadRequestException('A binary photo body is required');
      const result = await this.avatars.change(
        input,
        key,
        request.body,
        context
      );
      if (!result.ok) throw result.error;
      return result.value;
    } finally {
      this.active--;
    }
  }

  @Delete()
  @Header('Cache-Control', 'no-store')
  async remove(
    @AuthUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string,
    @Headers('if-match') match: string
  ) {
    const result = await this.avatars.change(
      { expectedRevision: this.revision(match), source: null },
      key,
      null,
      this.context(user)
    );
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async read(@AuthUser() user: AuthenticatedUser, @Param('id') id: string) {
    const result = await this.avatars.read(id, this.context(user));
    if (!result.ok) throw result.error;
    return new StreamableFile(Buffer.from(result.value.bytes), {
      type: 'image/webp',
      length: result.value.bytes.byteLength,
    });
  }

  private revision(match: string): number {
    if (
      typeof match !== 'string' ||
      !/^"[1-9][0-9]{0,15}"$/.test(match) ||
      !Number.isSafeInteger(Number(match.slice(1, -1)))
    )
      throw new BadRequestException(
        'If-Match must contain the quoted profile revision'
      );
    return Number(match.slice(1, -1));
  }

  private context(user: AuthenticatedUser): IdentityManagementContext {
    const roles = user.userClaims?.roles;
    return {
      identityId: user.userId,
      timestamp: Date.now(),
      subject: { roles: Array.isArray(roles) ? roles : [] },
    };
  }
}
