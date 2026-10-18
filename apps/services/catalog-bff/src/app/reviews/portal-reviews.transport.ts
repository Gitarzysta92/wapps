import { HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { TrustedPortalViewer } from '../identity/trusted-portal-identity';
import { reviewUnavailable } from './portal-reviews.request';

const errors: Record<number, string> = {
  400: 'Check the review fields, cursor or saved revision',
  401: 'Sign in again to review',
  403: 'Review access denied',
  404: 'The application or review is no longer available',
  409: 'The review changed or this request key was already used. Reload before continuing.',
  413: 'Review request exceeds the size limit',
  429: 'Review request limit reached. Try again later.',
};

@Injectable()
export class PortalReviewsTransport {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}
  async send(
    actor: TrustedPortalViewer,
    path: `/api/reviews${string}`,
    options: {
      method?: 'GET' | 'PUT' | 'POST' | 'DELETE';
      body?: unknown;
      key?: string;
    } = {}
  ) {
    try {
      const configured = this.config.get<string>('DISCUSSION_URL');
      if (!configured) throw reviewUnavailable();
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw reviewUnavailable();
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: url.origin + path,
          method: options.method ?? 'GET',
          ...(options.body === undefined ? {} : { data: options.body }),
          headers: {
            ...actor.headers,
            Accept: 'application/json',
            ...(options.body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...(options.key ? { 'Idempotency-Key': options.key } : {}),
          },
          timeout: 15_000,
          signal: AbortSignal.timeout(15_000),
          maxRedirects: 0,
          maxBodyLength: 32 * 1024,
          maxContentLength: 512 * 1024,
          responseType: 'json',
        })
      );
      if (
        response.status !== (options.method === 'POST' ? 201 : 200) ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw reviewUnavailable();
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
      // An uncertain command may have committed; the owning service alone replays receipts.
      throw reviewUnavailable();
    }
  }
}
