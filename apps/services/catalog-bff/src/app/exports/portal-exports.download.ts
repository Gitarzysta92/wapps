import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { Request, Response } from 'express';
import { ACCOUNT_EXPORT_LIMITS } from '@sdk/features/identity/core';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';
import { PortalExportsClient } from './portal-exports.client';

@Injectable()
export class PortalExportDownloads {
  private active = 0;
  constructor(private readonly exports: PortalExportsClient) {}

  async send(
    actor: TrustedPortalIdentity,
    id: string,
    request: Request,
    response: Response
  ) {
    if (this.active >= 4)
      throw new ServiceUnavailableException('Account downloads are busy');
    this.active++;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    const timer = setTimeout(cancel, ACCOUNT_EXPORT_LIMITS.attemptMs);
    request.once('aborted', cancel);
    response.once('close', cancel);
    if (request.aborted || response.destroyed) cancel();
    let stream: Readable | undefined;
    try {
      const job = await this.exports.inspect(actor, id, controller.signal);
      if (job.status !== 'ready')
        throw new ConflictException(
          'This account export is not ready for download'
        );
      stream = await this.exports.archive(actor, job, controller.signal);
      const hash = createHash('sha256');
      let bytes = 0;
      let pending: Buffer | undefined;
      const write = async (chunk: Buffer) => {
        controller.signal.throwIfAborted();
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
      };
      for await (const part of stream) {
        controller.signal.throwIfAborted();
        if (!Buffer.isBuffer(part) || !part.length)
          throw new Error('Invalid archive chunk');
        bytes += part.length;
        if (job.bytes === null || bytes > job.bytes)
          throw new Error('Export exceeds declared length');
        hash.update(part);
        for (
          let offset = 0;
          offset < part.length;
          offset += ACCOUNT_EXPORT_LIMITS.chunkBytes
        ) {
          if (pending) await write(pending);
          pending = part.subarray(
            offset,
            offset + ACCOUNT_EXPORT_LIMITS.chunkBytes
          );
        }
      }
      if (!pending || bytes !== job.bytes || hash.digest('hex') !== job.sha256)
        throw new Error('Incomplete or corrupt archive');
      // Withhold the final bytes until EOF and digest validation, so a broken stream cannot look complete.
      await write(pending);
      response.end();
    } finally {
      clearTimeout(timer);
      request.removeListener('aborted', cancel);
      response.removeListener('close', cancel);
      controller.abort();
      if (stream) {
        stream.destroy();
        await finished(stream, { cleanup: true }).catch(() => undefined);
      }
      this.active--;
    }
  }
}
