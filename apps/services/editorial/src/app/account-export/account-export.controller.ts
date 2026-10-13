import { once } from 'node:events';
import { Body, Controller, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ACCOUNT_EXPORT_LIMITS,
  AccountExportCaptureSequence,
  AccountExportLimitExceeded,
  accountExportObject,
  CanonicalIdentityAccessDenied,
  CanonicalIdentityInputError,
} from '@sdk/features/identity/core';
import { AccountExportSourceAccess } from '@sdk/features/identity/libs/management';
import { EditorialUser } from '../http/editorial-auth';
import type { EditorialActor } from '../application/editorial.ports';

@Controller('internal/account-export')
export class AccountExportController {
  constructor(private readonly access: AccountExportSourceAccess) {}

  @Post()
  async capture(
    @Body() body: unknown,
    @Query() query: unknown,
    @EditorialUser() actor: EditorialActor,
    @Req() request: Request,
    @Res() response: Response
  ) {
    const controller = new AbortController();
    const cancel = () =>
      controller.abort(new Error('Account export source connection closed'));
    const timer = setTimeout(
      () =>
        controller.abort(new Error('Account export source stream timed out')),
      300_000
    );
    request.once('aborted', cancel);
    response.once('close', cancel);
    if (request.aborted || response.destroyed) cancel();
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      accountExportObject(query, []);
      const source = await this.access.capture(body, actor, controller.signal);
      const sequence = new AccountExportCaptureSequence('editorial');
      let bytes = 0;
      for await (const input of source) {
        controller.signal.throwIfAborted();
        const line = Buffer.from(JSON.stringify(sequence.accept(input)) + '\n');
        bytes += line.length;
        if (
          line.length > ACCOUNT_EXPORT_LIMITS.recordBytes ||
          bytes > ACCOUNT_EXPORT_LIMITS.uncompressedBytes
        )
          throw new AccountExportLimitExceeded(
            'Account export source exceeds stream bounds'
          );
        if (!response.headersSent) {
          response.status(200);
          response.setHeader(
            'Content-Type',
            'application/x-ndjson; charset=utf-8'
          );
        }
        if (!response.write(line))
          await once(response, 'drain', { signal: controller.signal });
      }
      sequence.finish();
      response.end();
    } catch (error) {
      if (response.destroyed) return;
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status =
        error instanceof CanonicalIdentityAccessDenied
          ? 403
          : error instanceof CanonicalIdentityInputError
          ? 400
          : 503;
      if (status === 503) response.setHeader('Retry-After', '2');
      response.status(status).json({
        statusCode: status,
        message:
          status === 503
            ? 'Account export source unavailable'
            : status === 403
            ? 'Account export access denied'
            : 'Invalid account export request',
      });
    } finally {
      clearTimeout(timer);
      request.removeListener('aborted', cancel);
      response.removeListener('close', cancel);
      controller.abort();
    }
  }
}
