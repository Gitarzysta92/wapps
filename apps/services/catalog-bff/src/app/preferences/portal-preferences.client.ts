import {
  Injectable,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import {
  parseAccountPreferences,
  parsePreferencesUpdateReceipt,
  type PreferencesUpdate,
} from '@domains/customer/preferences';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';

const publicErrors: Record<number, string> = {
  400: 'Invalid preferences request',
  401: 'Sign in again to access preferences',
  403: 'Preferences access denied',
  404: 'Account preferences unavailable',
  409: 'Your account changed. Reload saved preferences before saving.',
  413: 'Preferences request exceeds the size limit',
  429: 'Too many preferences requests. Try again later.',
};

@Injectable()
export class PortalPreferencesClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async read(actor: TrustedPortalIdentity) {
    const response = await this.send(actor);
    try {
      const value = parseAccountPreferences(response);
      if (value.identityId !== actor.identityId)
        throw new Error('Unexpected account');
      return value;
    } catch {
      throw this.unavailable();
    }
  }

  async update(
    actor: TrustedPortalIdentity,
    input: PreferencesUpdate,
    key: string
  ) {
    const response = await this.send(actor, input, key);
    try {
      const receipt = parsePreferencesUpdateReceipt(response);
      if (
        receipt.identityId !== actor.identityId ||
        receipt.revision !== input.expectedRevision + 1
      )
        throw new Error('Unexpected save receipt');
      return receipt;
    } catch {
      throw this.unavailable();
    }
  }

  private async send(
    actor: TrustedPortalIdentity,
    input?: PreferencesUpdate,
    key?: string
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
          url: url.origin + '/api/me/preferences',
          method: input ? 'PUT' : 'GET',
          ...(input ? { data: input } : {}),
          headers: {
            ...actor.headers,
            Accept: 'application/json',
            ...(input
              ? { 'Content-Type': 'application/json', 'Idempotency-Key': key }
              : {}),
          },
          timeout: 15_000,
          maxRedirects: 0,
          maxContentLength: 64 * 1024,
          maxBodyLength: 64 * 1024,
        })
      );
      if (
        response.status !== 200 ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw new Error('Invalid preferences response');
      return response.data;
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status && publicErrors[status])
          throw new HttpException(publicErrors[status], status);
      }
      // A failed PUT may have committed. The caller retains its original key for retry.
      throw this.unavailable();
    }
  }

  private unavailable() {
    return new ServiceUnavailableException(
      'Could not confirm account preferences. Retry the same request.'
    );
  }
}
