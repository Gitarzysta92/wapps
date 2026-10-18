import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { PROFILE_AVATAR_OUTPUT_LIMIT } from '@domains/customer/profiles';
import type { TrustedPortalViewer } from '../identity/trusted-portal-identity';

export type ProfileSection =
  | 'favorites'
  | 'suites'
  | 'articles'
  | 'discussions'
  | 'activity';
type ProfilePath =
  | '/api/profiles'
  | `/api/profiles/${string}`
  | '/api/me/profile-follows'
  | '/api/me/profile-follows/outgoing'
  | '/api/me/totals'
  | '/api/me/badges'
  | '/api/admin/profile-badges'
  | `/api/admin/profile-badges/${string}`;
const errors: Record<number, string> = {
  400: 'Invalid profile request',
  401: 'Sign in again to access this profile',
  403: 'Profile action denied',
  404: 'Profile or photo unavailable',
  409: 'Profile state changed. Reload before trying again.',
  413: 'Profile request exceeds the size limit',
  429: 'Too many profile requests. Try again later.',
};

@Injectable()
export class PortalProfilesTransport {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async send(
    viewer: TrustedPortalViewer,
    path: ProfilePath,
    options: {
      after?: string | null;
      data?: unknown;
      key?: string;
      binary?: boolean;
    } = {}
  ): Promise<unknown> {
    try {
      const configured = this.config.get<string>('ACCOUNT_MANAGEMENT_URL');
      if (!configured) throw new Error('Unconfigured account service');
      const url = new URL(configured);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('Invalid account origin');
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: url.origin + path,
          method: options.data === undefined ? 'GET' : 'PUT',
          data: options.data,
          params:
            options.after === null || options.after === undefined
              ? undefined
              : { after: options.after },
          headers: {
            ...viewer.headers,
            Accept: options.binary ? 'image/webp' : 'application/json',
            ...(options.key ? { 'Idempotency-Key': options.key } : {}),
          },
          timeout: 30_000,
          signal: AbortSignal.timeout(30_000),
          maxRedirects: 0,
          maxBodyLength: 64 * 1024,
          maxContentLength: options.binary
            ? PROFILE_AVATAR_OUTPUT_LIMIT
            : 1024 * 1024,
          responseType: options.binary ? 'arraybuffer' : 'json',
        })
      );
      if (
        response.status !== 200 ||
        !(
          options.binary
            ? /^image\/webp(?:\s*;|$)/i
            : /^application\/json(?:\s*;|$)/i
        ).test(String(response.headers['content-type']))
      )
        throw new Error('Invalid account response');
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status && errors[status])
          throw new HttpException(errors[status], status);
      }
      throw new ServiceUnavailableException(
        'Could not confirm profile operation. Reload or retry the same change.'
      );
    }
  }

  decode<T>(parse: () => T): T {
    try {
      return parse();
    } catch {
      throw new ServiceUnavailableException(
        'Profile response could not be confirmed'
      );
    }
  }
}
