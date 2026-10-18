import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { TrustedPortalIdentity } from '../identity/trusted-portal-identity';
import {
  AccountAdminAction,
  accountAdminOperations,
  accountAdminReceipt,
} from './portal-account-admin.contracts';
const errors: Record<number, string> = {
  400: 'Invalid account administration request',
  401: 'Sign in again to administer accounts',
  403: 'Account administration denied',
  404: 'Account unavailable',
  409: 'Account state conflicts with this operation',
  429: 'Too many account administration requests',
};

@Injectable()
export class PortalAccountAdminClient {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService
  ) {}

  async change(
    actor: TrustedPortalIdentity,
    uid: string,
    action: AccountAdminAction,
    body?: Record<string, unknown>
  ) {
    try {
      const origin = this.config.get<string>('ACCOUNT_MANAGEMENT_URL');
      if (!origin) throw new Error('Account service unconfigured');
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
      const operation = accountAdminOperations[action];
      const response = await firstValueFrom(
        this.http.request<unknown>({
          url: `${url.origin}/api/admin/users/${encodeURIComponent(uid)}${
            action === 'delete' ? '' : `/${action}`
          }`,
          method: operation.method,
          data: body,
          headers: { ...actor.headers, Accept: 'application/json' },
          timeout: 10_000,
          maxRedirects: 0,
          maxBodyLength: 8192,
          maxContentLength: 16384,
          responseType: 'json',
        })
      );
      if (
        response.status !== operation.status ||
        !/^application\/json(?:\s*;|$)/i.test(
          String(response.headers['content-type'])
        )
      )
        throw new Error('Invalid administration receipt');
      return accountAdminReceipt(action, uid, response.data);
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status && errors[status])
          throw new HttpException(errors[status], status);
      }
      // A lost response may follow a committed mutation. Never replay a staff command automatically.
      throw new ServiceUnavailableException(
        'Could not confirm account administration operation'
      );
    }
  }
}
