import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ACCOUNT_EXPORT_LIMITS,
  AccountExportSourceInvalid,
  CanonicalIdentityInputError,
  CanonicalIdentityUnavailable,
  accountExportObject,
} from '@sdk/features/identity/core';
import {
  AccountExportService,
  type IdentityManagementContext,
} from '@sdk/features/identity/libs/management';
import {
  AuthUser,
  type AuthenticatedUser,
} from '../decorators/auth-user.decorator';

@Controller('me/exports')
export class AccountExportController {
  private downloads = 0;
  constructor(private readonly exports: AccountExportService) {}

  @Post()
  @HttpCode(202)
  @Header('Cache-Control', 'private, no-store')
  async request(
    @AuthUser() user: AuthenticatedUser,
    @Body() body: unknown,
    @Query() query: unknown,
    @Req() request: Request
  ) {
    accountExportObject(body, []);
    accountExportObject(query, []);
    const headers = request.rawHeaders.filter(
      (value, index) =>
        index % 2 === 0 && value.toLowerCase() === 'idempotency-key'
    );
    if (headers.length !== 1)
      throw new CanonicalIdentityInputError('One Idempotency-Key is required');
    const result = await this.exports.request(
      request.headers['idempotency-key'],
      this.context(user)
    );
    if (!result.ok) throw result.error;
    return result.value;
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async latest(@AuthUser() user: AuthenticatedUser, @Query() query: unknown) {
    accountExportObject(query, []);
    const result = await this.exports.latest(this.context(user));
    if (!result.ok) throw result.error;
    return { job: result.value };
  }
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  async inspect(
    @AuthUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: unknown
  ) {
    accountExportObject(query, []);
    const result = await this.exports.inspect(id, this.context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }
  @Delete(':id')
  @Header('Cache-Control', 'private, no-store')
  async cancel(
    @AuthUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: unknown,
    @Body() body: unknown
  ) {
    accountExportObject(query, []);
    accountExportObject(body ?? {}, []);
    const result = await this.exports.cancel(id, this.context(user));
    if (!result.ok) throw result.error;
    return result.value;
  }
  @Get(':id/download')
  async download(
    @AuthUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: unknown,
    @Req() request: Request,
    @Res() response: Response
  ) {
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; sandbox"
    );
    accountExportObject(query, []);
    if (request.headers.range !== undefined)
      throw new CanonicalIdentityInputError(
        'Download the complete archive without a Range header'
      );
    const result = await this.exports.download(id, this.context(user));
    if (!result.ok) throw result.error;
    if (this.downloads >= 4)
      throw new CanonicalIdentityUnavailable('Account downloads are busy');
    const { job, chunks } = result.value;
    if (job.bytes === null || job.sha256 === null)
      throw new CanonicalIdentityUnavailable(
        'Account export metadata unavailable'
      );
    const iterator = chunks[Symbol.asyncIterator]();
    this.downloads++;
    const controller = new AbortController(),
      hash = createHash('sha256');
    const cancel = () =>
      controller.abort(new Error('Account download disconnected'));
    const timer = setTimeout(
      () => controller.abort(new Error('Account download timed out')),
      ACCOUNT_EXPORT_LIMITS.attemptMs
    );
    request.once('aborted', cancel);
    response.once('close', cancel);
    if (request.aborted || response.destroyed) cancel();
    let bytes = 0;
    let finished = false;
    try {
      for (;;) {
        const entry = await this.next(iterator, controller.signal);
        if (entry.done) {
          finished = true;
          break;
        }
        const chunk = entry.value;
        controller.signal.throwIfAborted();
        if (
          !(chunk instanceof Uint8Array) ||
          chunk.byteLength < 1 ||
          chunk.byteLength > ACCOUNT_EXPORT_LIMITS.chunkBytes
        )
          throw new AccountExportSourceInvalid('Invalid export chunk');
        bytes += chunk.byteLength;
        if (bytes > job.bytes)
          throw new AccountExportSourceInvalid(
            'Export exceeds its declared length'
          );
        hash.update(chunk);
        if (bytes === job.bytes && hash.digest('hex') !== job.sha256)
          throw new AccountExportSourceInvalid('Export digest mismatch');
        if (!response.headersSent) {
          response.setHeader('Content-Type', 'application/gzip');
          response.setHeader('Content-Length', String(job.bytes));
          response.setHeader(
            'Content-Disposition',
            `attachment; filename="wapps-account-${job.id}.ndjson.gz"`
          );
        }
        if (!response.write(chunk))
          await once(response, 'drain', { signal: controller.signal });
      }
      if (bytes !== job.bytes)
        throw new AccountExportSourceInvalid('Incomplete export');
      response.end();
    } catch (error) {
      if (!response.destroyed) {
        if (response.headersSent) response.destroy();
        else {
          response.removeHeader('Content-Length');
          response.removeHeader('Content-Disposition');
          response.removeHeader('Content-Type');
          throw error;
        }
      }
    } finally {
      clearTimeout(timer);
      request.removeListener('aborted', cancel);
      response.removeListener('close', cancel);
      controller.abort();
      if (finished) this.downloads--;
      else {
        // A cancelled SQL read may still be pending. Retain its permit until cleanup settles.
        void Promise.resolve()
          .then(() => iterator.return?.())
          .catch(() => undefined)
          .finally(() => this.downloads--);
      }
    }
  }
  private async next<T>(iterator: AsyncIterator<T>, signal: AbortSignal) {
    signal.throwIfAborted();
    let abort: () => void = () => undefined;
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener('abort', abort, { once: true });
    });
    try {
      return await Promise.race([iterator.next(), cancelled]);
    } finally {
      signal.removeEventListener('abort', abort);
    }
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
