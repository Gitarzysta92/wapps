import { HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { TrustedPortalViewer } from '../identity/trusted-portal-identity';
import { releaseUnavailable } from './portal-releases.request';

type ReleasePath =
  | `/api/me/releases${string}`
  | `/api/editorial/release-reviews${string}`
  | `/api/catalog/releases/${string}`;
const errors: Record<number, string> = {
  400: 'Check the release fields, filters or review decision',
  401: 'Sign in again to access releases',
  403: 'Release access denied',
  404: 'Release or application not found or no longer available',
  409: 'The release, submission or ownership changed, or the requested action conflicts with its current state. Reload before continuing.',
  413: 'Release request exceeds the size limit',
  429: 'Release request limit reached. Try again later.',
};

@Injectable()
export class PortalReleasesTransport {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async send(
    actor: TrustedPortalViewer,
    path: ReleasePath,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      key?: string;
    } = {}
  ) {
    try {
      const configured = this.config.get<string>('EDITORIAL_URL');
      if (!configured) throw releaseUnavailable();
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw releaseUnavailable();
      const method = options.method ?? 'GET';
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: url.origin + path,
          method,
          ...(options.body === undefined ? {} : { data: options.body }),
          headers: {
            ...actor.headers,
            Accept: 'application/json',
            ...(options.key ? { 'Idempotency-Key': options.key } : {}),
            ...(options.body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          timeout: 15_000,
          signal: AbortSignal.timeout(15_000),
          maxRedirects: 0,
          maxBodyLength: 64 * 1024,
          // The bounded workspace can contain 100 multibyte drafts of 16,000 UTF-16 units each.
          maxContentLength:
            (method === 'GET' && path === '/api/me/releases' ? 6 : 2) *
            1024 *
            1024,
          responseType: 'json',
        })
      );
      if (
        response.status !== (method === 'POST' ? 201 : 200) ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw releaseUnavailable();
      return response.data;
    } catch (error) {
      if (
        isAxiosError(error) &&
        error.response &&
        errors[error.response.status]
      )
        throw new HttpException(
          errors[error.response.status],
          error.response.status
        );
      // A lost reply can follow a commit. Only the caller replays its original key.
      throw releaseUnavailable();
    }
  }
}
