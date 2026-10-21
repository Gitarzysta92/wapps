import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'node:stream';
import {
  accountExportObject,
  parseAccountExportJob,
  type AccountExportJob,
} from '@sdk/features/identity/core';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';

const errors: Record<number, string> = {
  400: 'Invalid account export request',
  401: 'Sign in again to access your account export',
  403: 'Account export access denied',
  404: 'Account export unavailable',
  409: 'Account export state changed or request limit reached. Refresh its status.',
  413: 'Account export request exceeds the size limit',
  429: 'Too many account export requests. Try again later.',
};

function unavailable() {
  return new ServiceUnavailableException(
    'Could not confirm the account export operation. Refresh or retry the same request.'
  );
}

@Injectable()
export class PortalExportsClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async latest(actor: TrustedPortalIdentity) {
    const raw = await this.json(actor, '', 'GET');
    return this.decode(() => {
      const row = accountExportObject(raw, ['job']);
      return {
        job: row['job'] === null ? null : parseAccountExportJob(row['job']),
      };
    });
  }

  async request(actor: TrustedPortalIdentity, key: string) {
    return this.decodeJob(await this.json(actor, '', 'POST', key));
  }

  async inspect(
    actor: TrustedPortalIdentity,
    id: string,
    signal?: AbortSignal
  ) {
    return this.decodeJob(
      await this.json(actor, `/${id}`, 'GET', undefined, signal),
      id
    );
  }

  async cancel(actor: TrustedPortalIdentity, id: string) {
    const job = this.decodeJob(await this.json(actor, `/${id}`, 'DELETE'), id);
    if (!['cancelled', 'expired'].includes(job.status)) throw unavailable();
    return job;
  }

  async archive(
    actor: TrustedPortalIdentity,
    job: AccountExportJob,
    signal: AbortSignal
  ): Promise<Readable> {
    let stream: Readable | undefined;
    try {
      const response = await firstValueFrom(
        this.http.request<Readable>({
          url: this.origin() + `/api/me/exports/${job.id}/download`,
          method: 'GET',
          headers: {
            ...actor.headers,
            Accept: 'application/gzip',
            'Accept-Encoding': 'identity',
          },
          responseType: 'stream',
          decompress: false,
          maxRedirects: 0,
          maxBodyLength: 0,
          timeout: 30_000,
          signal,
          // Never consume an unbounded error body; status is enough to map it safely.
          validateStatus: () => true,
        })
      );
      stream = response.data;
      if (response.status !== 200) throw this.statusError(response.status);
      if (
        !(stream instanceof Readable) ||
        String(response.headers['content-type']).toLowerCase() !==
          'application/gzip' ||
        response.headers['content-encoding'] !== undefined ||
        response.headers['content-length'] !== String(job.bytes) ||
        response.headers['content-range'] !== undefined
      )
        throw unavailable();
      return stream;
    } catch (error) {
      if (stream instanceof Readable) stream.destroy();
      throw error instanceof HttpException ? error : unavailable();
    }
  }

  private async json(
    actor: TrustedPortalIdentity,
    suffix: '' | `/${string}`,
    method: 'GET' | 'POST' | 'DELETE',
    key?: string,
    signal?: AbortSignal
  ): Promise<unknown> {
    try {
      const deadline = AbortSignal.timeout(15_000);
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: this.origin() + '/api/me/exports' + suffix,
          method,
          ...(method === 'POST' ? { data: {} } : {}),
          headers: {
            ...actor.headers,
            Accept: 'application/json',
            ...(key ? { 'Idempotency-Key': key } : {}),
          },
          timeout: 15_000,
          signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
          maxRedirects: 0,
          maxBodyLength: 64 * 1024,
          maxContentLength: 64 * 1024,
          responseType: 'json',
        })
      );
      if (
        response.status !== (method === 'POST' ? 202 : 200) ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw unavailable();
      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response)
        throw this.statusError(error.response.status);
      throw unavailable();
    }
  }

  private origin() {
    const configured = this.config.get<string>('ACCOUNT_MANAGEMENT_URL');
    if (!configured) throw unavailable();
    const url = new URL(configured);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.pathname !== '/' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw unavailable();
    return url.origin;
  }

  private statusError(status: number) {
    return errors[status]
      ? new HttpException(errors[status], status)
      : unavailable();
  }

  private decodeJob(raw: unknown, id?: string) {
    return this.decode(() => {
      const job = parseAccountExportJob(raw);
      if (id !== undefined && job.id !== id)
        throw new Error('Mismatched export');
      return job;
    });
  }

  private decode<T>(parse: () => T): T {
    try {
      return parse();
    } catch {
      throw unavailable();
    }
  }
}
