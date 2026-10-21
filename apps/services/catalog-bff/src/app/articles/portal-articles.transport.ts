import { HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  ARTICLE_COVER_OUTPUT_LIMIT,
  ARTICLE_COVER_SOURCE_LIMIT,
} from '@domains/catalog/media';
import type { TrustedPortalViewer } from '../identity/trusted-portal-identity';
import { articleUnavailable } from './portal-articles.request';

type ArticlePath =
  | `/api/me/articles${string}`
  | `/api/me/article-covers${string}`
  | `/api/editorial/article-reviews${string}`
  | `/api/catalog/articles${string}`
  | `/api/catalog/article-selection?${string}`
  | `/api/catalog/article-visibility/${string}`
  | `/api/media/articles/${string}`;
const errors: Record<number, string> = {
  400: 'Check the article fields, filters, review decision or cover request',
  401: 'Sign in again to access the article workspace',
  403: 'Article workspace access denied',
  404: 'Article, review or cover not found or no longer available',
  409: 'The article, submission or cover changed, or the requested action conflicts with its current state. Reload before continuing.',
  413: 'Article request exceeds the size limit',
  415: 'Unsupported article cover format',
  422: 'Invalid article cover',
  429: 'Article request or retry limit reached. Try again later.',
};

@Injectable()
export class PortalArticlesTransport {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async send(
    actor: TrustedPortalViewer,
    path: ArticlePath,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: unknown;
      key?: string;
      revision?: number;
      binary?: boolean;
      signal?: AbortSignal;
    } = {}
  ) {
    try {
      const configured = this.config.get<string>('EDITORIAL_URL');
      if (!configured) throw articleUnavailable();
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw articleUnavailable();
      const uploading = Buffer.isBuffer(options.body);
      const deadline = uploading ? 30_000 : 15_000;
      const timeout = AbortSignal.timeout(deadline);
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: url.origin + path,
          method: options.method ?? 'GET',
          ...(options.body === undefined ? {} : { data: options.body }),
          headers: {
            ...actor.headers,
            Accept: options.binary ? 'image/webp' : 'application/json',
            ...(options.key ? { 'Idempotency-Key': options.key } : {}),
            ...(options.body === undefined
              ? {}
              : {
                  'Content-Type': uploading
                    ? 'application/octet-stream'
                    : 'application/json',
                }),
            ...(options.revision === undefined
              ? {}
              : { 'If-Match': `"${options.revision}"` }),
          },
          timeout: deadline,
          signal: options.signal
            ? AbortSignal.any([timeout, options.signal])
            : timeout,
          maxRedirects: 0,
          maxBodyLength: uploading ? ARTICLE_COVER_SOURCE_LIMIT : 96 * 1024,
          // A workspace can hold 100 drafts of 24,000 multibyte UTF-16 units each.
          maxContentLength: options.binary
            ? ARTICLE_COVER_OUTPUT_LIMIT
            : (options.method === undefined || options.method === 'GET') &&
              path === '/api/me/articles'
            ? 8 * 1024 * 1024
            : 2 * 1024 * 1024,
          responseType: options.binary ? 'arraybuffer' : 'json',
          decompress: !options.binary,
        })
      );
      if (
        response.status !== (options.method === 'POST' ? 201 : 200) ||
        !(
          options.binary
            ? /^image\/webp(?:\s*;|$)/i
            : /^application\/json(?:\s*;|$)/i
        ).test(String(response.headers['content-type']))
      )
        throw articleUnavailable();
      if (options.binary) {
        const bytes = response.data;
        const length = response.headers['content-length'];
        const encoding = response.headers['content-encoding'];
        if (
          !Buffer.isBuffer(bytes) ||
          bytes.length < 12 ||
          bytes.length > ARTICLE_COVER_OUTPUT_LIMIT ||
          typeof length !== 'string' ||
          !/^[1-9][0-9]*$/.test(length) ||
          Number(length) !== bytes.length ||
          (encoding !== undefined && encoding !== 'identity') ||
          bytes.toString('ascii', 0, 4) !== 'RIFF' ||
          bytes.toString('ascii', 8, 12) !== 'WEBP' ||
          bytes.readUInt32LE(4) + 8 !== bytes.length
        )
          throw articleUnavailable();
      }
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
      // Editorial may have committed before losing the reply; replay belongs to the caller.
      throw articleUnavailable();
    }
  }
}
