import { HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { TrustedPortalViewer } from '../identity/trusted-portal-identity';
import { discussionUnavailable } from './portal-discussions.request';

type DiscussionPath = `/api/discussions${string}`;
const errors: Record<number, string> = {
  400: 'Check the discussion fields, cursor or saved revision',
  401: 'Sign in again to join the discussion',
  403: 'Discussion access denied',
  404: 'The content or discussion is no longer available',
  409: 'The discussion changed or this request key was already used. Reload before continuing.',
  413: 'Discussion request exceeds the size limit',
  429: 'Discussion request limit reached. Try again later.',
};

@Injectable()
export class PortalDiscussionsTransport {
  private activeThreads = 0;
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}
  async send(
    actor: TrustedPortalViewer,
    path: DiscussionPath,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      key?: string;
      thread?: boolean;
      generic?: boolean;
      selection?: boolean;
    } = {}
  ) {
    if (options.thread && this.activeThreads >= 2)
      throw discussionUnavailable();
    if (options.thread) this.activeThreads++;
    try {
      const configured = this.config.get<string>('DISCUSSION_URL');
      if (!configured) throw discussionUnavailable();
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw discussionUnavailable();
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
          maxBodyLength: (options.generic ? 300 : 32) * 1024,
          // Full threads allow 2,000 posts; JSON may escape each UTF-16 unit into six bytes.
          maxContentLength: options.thread
            ? 64 * 1024 * 1024
            : options.selection
            ? 2 * 1024 * 1024
            : 512 * 1024,
          responseType: 'json',
        })
      );
      if (
        response.status !== (options.method === 'POST' ? 201 : 200) ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw discussionUnavailable();
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
      // A lost response may follow a committed command. Only the owner can replay its receipt.
      throw discussionUnavailable();
    } finally {
      if (options.thread) this.activeThreads--;
    }
  }
}
