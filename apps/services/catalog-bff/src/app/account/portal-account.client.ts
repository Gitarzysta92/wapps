import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  parsePrivateProfile,
  parseProfileUpdateReceipt,
  PROFILE_AVATAR_OUTPUT_LIMIT,
  PROFILE_AVATAR_SOURCE_LIMIT,
  type ProfileAvatarChange,
  type ProfileUpdate,
} from '@domains/customer/profiles';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';
import {
  parsePortalAccount,
  parsePortalErasureReceipt,
} from './portal-account.contracts';

const errors: Record<number, string> = {
  400: 'Invalid account request',
  401: 'Sign in again to access your account',
  403: 'Account access denied',
  404: 'Profile or photo unavailable',
  409: 'Your account changed. Reload before saving.',
  413: 'Account request exceeds the size limit',
  415: 'Use PNG, JPEG or WebP photo bytes',
  429: 'Too many account requests. Try again later.',
};
type AccountPath =
  | '/api/me'
  | '/api/me/profile'
  | '/api/me/profile/avatar'
  | `/api/me/profile/avatar/${string}`;

@Injectable()
export class PortalAccountClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async account(actor: TrustedPortalIdentity) {
    const response = await this.send(actor, '/api/me');
    return this.decode(() => {
      const value = parsePortalAccount(response);
      if (
        value.identityId !== actor.identityId ||
        value.account.email !== actor.headers['x-user-email']
      )
        throw new Error('Unexpected account');
      return value;
    });
  }

  async erase(actor: TrustedPortalIdentity) {
    const response = await this.send(actor, '/api/me', 'DELETE', {
      status: 202,
    });
    return this.decode(() => {
      const receipt = parsePortalErasureReceipt(response);
      if (receipt.identityId !== actor.identityId)
        throw new Error('Unexpected account');
      return receipt;
    });
  }

  async profile(actor: TrustedPortalIdentity) {
    const response = await this.send(actor, '/api/me/profile');
    return this.decode(() => {
      const value = parsePrivateProfile(response);
      if (value.identityId !== actor.identityId)
        throw new Error('Unexpected account');
      return value;
    });
  }

  async update(
    actor: TrustedPortalIdentity,
    input: ProfileUpdate,
    key: string
  ) {
    const response = await this.send(actor, '/api/me/profile', 'PUT', {
      data: input,
      headers: { 'Idempotency-Key': key },
    });
    return this.receipt(response, actor.identityId, input.expectedRevision);
  }

  async changeAvatar(
    actor: TrustedPortalIdentity,
    input: ProfileAvatarChange,
    key: string,
    bytes?: Buffer
  ) {
    const response = await this.send(
      actor,
      '/api/me/profile/avatar',
      input.source ? 'PUT' : 'DELETE',
      {
        data: bytes,
        headers: {
          'Idempotency-Key': key,
          'If-Match': `"${input.expectedRevision}"`,
          ...(input.source
            ? {
                'Content-Type': input.source.contentType,
                'X-Avatar-Bytes': String(input.source.bytes),
                'X-Avatar-Sha256': input.source.sha256,
              }
            : {}),
        },
      }
    );
    return this.receipt(response, actor.identityId, input.expectedRevision);
  }

  async avatar(actor: TrustedPortalIdentity, id: string) {
    const bytes = await this.send(
      actor,
      `/api/me/profile/avatar/${encodeURIComponent(id)}`,
      'GET',
      { binary: true }
    );
    return this.decode(() => {
      if (
        !Buffer.isBuffer(bytes) ||
        bytes.length < 12 ||
        bytes.length > PROFILE_AVATAR_OUTPUT_LIMIT ||
        bytes.toString('ascii', 0, 4) !== 'RIFF' ||
        bytes.toString('ascii', 8, 12) !== 'WEBP' ||
        bytes.readUInt32LE(4) + 8 !== bytes.length
      )
        throw new Error('Invalid profile photo');
      return bytes;
    });
  }

  private receipt(input: unknown, identityId: string, expected: number) {
    return this.decode(() => {
      const receipt = parseProfileUpdateReceipt(input);
      if (
        receipt.identityId !== identityId ||
        receipt.revision !== expected + 1
      )
        throw new Error('Unexpected account receipt');
      return receipt;
    });
  }

  private decode<T>(parse: () => T): T {
    try {
      return parse();
    } catch {
      throw this.unavailable();
    }
  }

  private async send(
    actor: TrustedPortalIdentity,
    path: AccountPath,
    method = 'GET',
    options: {
      data?: ProfileUpdate | Buffer;
      headers?: Record<string, string>;
      binary?: boolean;
      status?: number;
    } = {}
  ) {
    try {
      const origin = this.config.get<string>('ACCOUNT_MANAGEMENT_URL');
      if (!origin) throw new Error('Unconfigured Account service');
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('Invalid Account origin');
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: url.origin + path,
          method,
          data: options.data,
          headers: {
            ...actor.headers,
            Accept: options.binary ? 'image/webp' : 'application/json',
            ...options.headers,
          },
          timeout: 15_000,
          maxRedirects: 0,
          maxBodyLength: Buffer.isBuffer(options.data)
            ? PROFILE_AVATAR_SOURCE_LIMIT
            : 64 * 1024,
          maxContentLength: options.binary
            ? PROFILE_AVATAR_OUTPUT_LIMIT
            : 64 * 1024,
          responseType: options.binary ? 'arraybuffer' : 'json',
        })
      );
      if (
        response.status !== (options.status ?? 200) ||
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
      // Mutations can commit before a response is lost; the caller owns retry intent.
      throw this.unavailable();
    }
  }

  private unavailable() {
    return new ServiceUnavailableException(
      'Could not confirm account operation. Reload or retry the same change.'
    );
  }
}
