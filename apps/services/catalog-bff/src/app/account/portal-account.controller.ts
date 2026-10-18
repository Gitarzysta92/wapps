import { createHash } from 'node:crypto';
import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  Header,
  HttpCode,
  HttpException,
  Param,
  PayloadTooLargeException,
  Put,
  Req,
  Res,
  ServiceUnavailableException,
  StreamableFile,
  UnsupportedMediaTypeException,
  UseFilters,
} from '@nestjs/common';
import { raw, type Request, type Response } from 'express';
import {
  isProfileAvatarId,
  parseProfileAvatarChange,
  parseProfileUpdate,
  PROFILE_AVATAR_SOURCE_LIMIT,
} from '@domains/customer/profiles';
import {
  singleHeader,
  TrustedPortalIdentityReader,
} from '../identity/trusted-portal-identity';
import { PortalAccountClient } from './portal-account.client';

@Catch()
export class PortalAccountErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 503;
    response.setHeader('Cache-Control', 'private, no-store');
    if (status === 503 || status === 429)
      response.setHeader('Retry-After', '2');
    response.status(status).json({
      statusCode: status,
      message:
        error instanceof HttpException ? error.message : 'Account unavailable',
    });
  }
}

@Controller('me')
@UseFilters(PortalAccountErrorFilter)
export class PortalAccountController {
  private uploads = 0;
  constructor(
    private readonly identities: TrustedPortalIdentityReader,
    private readonly account: PortalAccountClient
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  readAccount(@Req() request: Request) {
    const actor = this.identities.readWithEmail(request);
    this.noQuery(request);
    this.noBody(request);
    return this.account.account(actor);
  }

  @Delete()
  @HttpCode(202)
  @Header('Cache-Control', 'private, no-store')
  eraseAccount(@Req() request: Request) {
    const actor = this.identities.read(request);
    this.noQuery(request);
    this.noBody(request);
    return this.account.erase(actor);
  }

  @Get('profile')
  @Header('Cache-Control', 'private, no-store')
  readProfile(@Req() request: Request) {
    const actor = this.identities.read(request);
    this.noQuery(request);
    this.noBody(request);
    return this.account.profile(actor);
  }

  @Put('profile')
  @Header('Cache-Control', 'private, no-store')
  updateProfile(@Req() request: Request, @Body() body: unknown) {
    const actor = this.identities.read(request);
    this.noQuery(request);
    const key = this.key(request);
    let input;
    try {
      input = parseProfileUpdate(body);
    } catch {
      throw new BadRequestException('Invalid profile change');
    }
    return this.account.update(actor, input, key);
  }

  @Get('profile/avatar/:id')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; sandbox")
  async readAvatar(@Req() request: Request, @Param('id') id: string) {
    const actor = this.identities.read(request);
    this.noQuery(request);
    this.noBody(request);
    if (!isProfileAvatarId(id))
      throw new BadRequestException('Invalid profile photo ID');
    const bytes = await this.account.avatar(actor, id);
    return new StreamableFile(bytes, {
      type: 'image/webp',
      length: bytes.length,
    });
  }

  @Delete('profile/avatar')
  @Header('Cache-Control', 'private, no-store')
  removeAvatar(@Req() request: Request) {
    const actor = this.identities.read(request);
    this.noQuery(request);
    this.noBody(request);
    return this.account.changeAvatar(
      actor,
      { expectedRevision: this.revision(request), source: null },
      this.key(request)
    );
  }

  @Put('profile/avatar')
  @Header('Cache-Control', 'private, no-store')
  async uploadAvatar(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const actor = this.identities.read(request);
    this.noQuery(request);
    const key = this.key(request);
    const contentType = singleHeader(request, 'content-type', 64);
    const encoding = singleHeader(request, 'content-encoding', 32);
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(contentType ?? '') ||
      (encoding !== undefined && encoding !== 'identity')
    )
      throw new UnsupportedMediaTypeException(
        'Send uncompressed PNG, JPEG or WebP bytes'
      );
    const count = singleHeader(request, 'x-avatar-bytes', 7);
    if (!count || !/^[1-9][0-9]{0,6}$/.test(count))
      throw new BadRequestException('Invalid photo size');
    if (Number(count) > PROFILE_AVATAR_SOURCE_LIMIT)
      throw new PayloadTooLargeException('Photo exceeds 2 MiB');
    const length = singleHeader(request, 'content-length', 16);
    if (length !== undefined && Number(length) !== Number(count))
      throw new BadRequestException('Photo size mismatch');
    let input;
    try {
      input = parseProfileAvatarChange({
        expectedRevision: this.revision(request),
        source: {
          contentType,
          bytes: Number(count),
          sha256: singleHeader(request, 'x-avatar-sha256', 64),
        },
      });
    } catch {
      throw new BadRequestException('Invalid photo change');
    }
    if (this.uploads >= 2)
      throw new ServiceUnavailableException('Photo uploads are busy');
    this.uploads++;
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
      if (
        !Buffer.isBuffer(request.body) ||
        request.body.length !== input.source?.bytes ||
        createHash('sha256').update(request.body).digest('hex') !==
          input.source.sha256
      )
        throw new BadRequestException('Photo bytes do not match the command');
      return await this.account.changeAvatar(actor, input, key, request.body);
    } finally {
      this.uploads--;
    }
  }

  private key(request: Request) {
    const key = singleHeader(request, 'idempotency-key', 128);
    if (!key || !/^[\x21-\x7e]{1,128}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    return key;
  }

  private revision(request: Request) {
    const match = singleHeader(request, 'if-match', 18);
    if (
      !match ||
      !/^"[1-9][0-9]{0,15}"$/.test(match) ||
      !Number.isSafeInteger(Number(match.slice(1, -1)))
    )
      throw new BadRequestException(
        'If-Match must contain the quoted profile revision'
      );
    return Number(match.slice(1, -1));
  }

  private noQuery(request: Request) {
    if (Object.keys(request.query).length)
      throw new BadRequestException(
        'This account route does not accept query parameters'
      );
  }

  private noBody(request: Request) {
    if (
      request.headers['transfer-encoding'] !== undefined ||
      (request.headers['content-length'] !== undefined &&
        request.headers['content-length'] !== '0')
    )
      throw new BadRequestException(
        'This account route does not accept a body'
      );
  }
}
