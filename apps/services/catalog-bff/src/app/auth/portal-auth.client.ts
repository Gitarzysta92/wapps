import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';

export type PortalAuthOperation =
  | 'signin'
  | 'signin/anonymous'
  | 'signin/oauth'
  | 'refresh'
  | 'signout'
  | 'methods'
  | 'register'
  | 'password-reset/verify'
  | 'password-reset/complete'
  | 'email-verification/status'
  | 'email-verification/request'
  | 'email-verification/verify'
  | 'email-verification/complete';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid response');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.length || value.length > max)
    throw new Error('Invalid response');
  return value;
}

@Injectable()
export class PortalAuthClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async execute(
    operation: PortalAuthOperation,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<unknown> {
    const data = object(
      await this.send(
        'ACCOUNT_MANAGEMENT_URL',
        `/api/auth/${operation}`,
        body,
        headers
      )
    );
    try {
      if (
        [
          'signin',
          'signin/anonymous',
          'signin/oauth',
          'refresh',
          'register',
        ].includes(operation)
      ) {
        const expiresIn = text(data['expiresIn'], 10);
        if (!/^[1-9][0-9]*$/.test(expiresIn) || Number(expiresIn) > 86400)
          throw new Error('Invalid expiry');
        const token = text(data['token'], 16384),
          refreshToken = text(data['refreshToken'], 16384),
          uid = text(data['uid'], 128);
        if (/\s/.test(token) || /\s/.test(refreshToken) || uid.trim() !== uid)
          throw new Error('Invalid session');
        return { token, refreshToken, expiresIn, uid };
      }
      if (operation === 'methods') {
        if (!Array.isArray(data['methods']) || data['methods'].length > 16)
          throw new Error('Invalid methods');
        const methods = data['methods'].map((value) => {
          const method = object(value),
            provider = text(method['provider'], 64);
          if (
            !['EMAIL_PASSWORD', 'GOOGLE', 'GITHUB', 'ANONYMOUS'].includes(
              provider
            ) ||
            method['enabled'] !== true
          )
            throw new Error('Invalid method');
          return {
            provider,
            displayName: text(method['displayName'], 100),
            enabled: true,
          };
        });
        if (
          new Set(methods.map((method) => method.provider)).size !==
          methods.length
        )
          throw new Error('Duplicate method');
        return { methods };
      }
      if (operation === 'signout') {
        if (data['message'] !== 'Signed out successfully')
          throw new Error('Missing revocation confirmation');
        return { message: 'Signed out successfully' };
      }
      if (operation === 'email-verification/status') {
        if (typeof data['verified'] !== 'boolean')
          throw new Error('Invalid verification status');
        return {
          email: data['email'] === null ? null : text(data['email'], 254),
          verified: data['verified'],
        };
      }
      if (operation === 'email-verification/request') {
        if (
          !['requested', 'already-verified'].includes(String(data['outcome']))
        )
          throw new Error('Invalid verification receipt');
        return { outcome: data['outcome'] };
      }
      const field = operation.endsWith('/verify') ? 'valid' : 'completed';
      if (data[field] !== true) throw new Error('Invalid action receipt');
      return { [field]: true };
    } catch {
      throw this.unavailable();
    }
  }

  async recovery(body: { email: string }): Promise<unknown> {
    const data = object(
      await this.send(
        'ACCOUNT_MANAGEMENT_URL',
        '/api/password-recovery',
        body,
        {},
        202
      )
    );
    // Preserve the account owner's non-enumerating response contract.
    if (data['accepted'] !== true) throw this.unavailable();
    return { accepted: true };
  }

  async authorize(
    provider: 'google' | 'github',
    query: URLSearchParams
  ): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.get<unknown>(
          this.origin('ACCOUNT_MANAGEMENT_URL') +
            `/api/auth/oauth/${provider}/authorize?${query.toString()}`,
          {
            timeout: 10000,
            maxRedirects: 0,
            maxContentLength: 16384,
            validateStatus: (status) => status === 302,
          }
        )
      );
      const location = text(response.headers['location'], 8192),
        url = new URL(location);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw this.unavailable();
      return location;
    } catch (error) {
      throw this.failure(error);
    }
  }

  private async send(
    service: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
    expectedStatus = 200
  ): Promise<unknown> {
    try {
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: this.origin(service) + path,
          method: body === undefined ? 'GET' : 'POST',
          data: body,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...headers,
          },
          timeout: 15000,
          signal: AbortSignal.timeout(15000),
          maxRedirects: 0,
          maxContentLength: 64 * 1024,
          maxBodyLength: 32 * 1024,
        })
      );
      if (
        response.status !== expectedStatus ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw this.unavailable();
      return response.data;
    } catch (error) {
      throw this.failure(error);
    }
  }
  private origin(service: string): string {
    const origin = this.config.get<string>(service);
    if (!origin) throw this.unavailable();
    const url = new URL(origin);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw this.unavailable();
    return url.origin;
  }
  private failure(error: unknown): Error {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    const messages: Record<number, string> = {
      400: 'Check the authentication details',
      401: 'Credentials or session were rejected',
      403: 'Authentication action is not available',
      409: 'Account changed; review the request before retrying',
      413: 'Authentication request exceeds the size limit',
      429: 'Too many authentication attempts',
    };
    return status && messages[status]
      ? new HttpException(messages[status], status)
      : this.unavailable();
  }
  private unavailable(): Error {
    return new ServiceUnavailableException(
      'Authentication action could not be confirmed'
    );
  }
}
