import { HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  APPLICATION_IMAGE_OUTPUT_LIMIT,
  APPLICATION_IMAGE_SOURCE_LIMIT,
} from '@domains/catalog/media';
import type { TrustedPortalViewer } from '../identity/trusted-portal-identity';
import { applicationUnavailable } from './portal-application.request';

type ApplicationPath =
  | `/api/me/application-drafts${string}`
  | `/api/me/application-images${string}`
  | `/api/editorial/application-reviews${string}`
  | `/api/me/ownership-claims${string}`
  | `/api/editorial/ownership-reviews${string}`
  | `/api/media/applications/${string}`;
const errors: Record<number, string> = {
  400: 'Check the application fields, ownership request, review decision or image request',
  401: 'Sign in again to access the application workspace',
  403: 'Application workspace access denied',
  404: 'Application draft, ownership claim, review or image not found or no longer available',
  409: 'The application, ownership claim, submission or image changed, or the requested action conflicts with its current state. Reload before continuing.',
  413: 'Application request exceeds the size limit',
  415: 'Unsupported application image format',
  422: 'Invalid application image',
  429: 'Application request or retry limit reached. Try again later.',
};

@Injectable()
export class PortalApplicationTransport {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async send(
    actor: TrustedPortalViewer,
    path: ApplicationPath,
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
      if (!configured) throw applicationUnavailable();
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw applicationUnavailable();
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
          maxBodyLength: uploading ? APPLICATION_IMAGE_SOURCE_LIMIT : 64 * 1024,
          maxContentLength: options.binary
            ? APPLICATION_IMAGE_OUTPUT_LIMIT
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
        throw applicationUnavailable();
      if (options.binary) {
        const bytes = response.data;
        const length = response.headers['content-length'];
        const encoding = response.headers['content-encoding'];
        if (
          !Buffer.isBuffer(bytes) ||
          bytes.length < 12 ||
          bytes.length > APPLICATION_IMAGE_OUTPUT_LIMIT ||
          typeof length !== 'string' ||
          !/^[1-9][0-9]*$/.test(length) ||
          Number(length) !== bytes.length ||
          (encoding !== undefined && encoding !== 'identity') ||
          bytes.toString('ascii', 0, 4) !== 'RIFF' ||
          bytes.toString('ascii', 8, 12) !== 'WEBP' ||
          bytes.readUInt32LE(4) + 8 !== bytes.length
        )
          throw applicationUnavailable();
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
      throw applicationUnavailable();
    }
  }
}
