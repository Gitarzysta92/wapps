import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, defer, map, of, timeout } from 'rxjs';
import { err, ok } from '@sdk/kernel/standard';
import {
  accountExportObject,
  isCanonicalIdentityId,
} from '@sdk/features/identity/core';
import {
  ACCOUNT_ERASURE_URL,
  type AccountErasureAcceptance,
  type AccountErasurePort,
} from '../application/account-erasure.port';
import { SKIP_AUTHENTICATION_RECOVERY } from './authentication-request-context';

@Injectable()
export class AccountErasureApiService implements AccountErasurePort {
  private readonly http = inject(HttpClient);
  private readonly url = accountErasureEndpoint(inject(ACCOUNT_ERASURE_URL));
  private context() {
    return new HttpContext().set(SKIP_AUTHENTICATION_RECOVERY, true);
  }
  prepare() {
    return this.http.get<unknown>(this.url, { context: this.context() }).pipe(
      timeout(15_000),
      map((value) => {
        if (
          !value ||
          typeof value !== 'object' ||
          !('identityId' in value) ||
          !isCanonicalIdentityId(value.identityId) ||
          !('profile' in value) ||
          !value.profile ||
          typeof value.profile !== 'object' ||
          !('name' in value.profile) ||
          (value.profile.name !== null &&
            typeof value.profile.name !== 'string') ||
          !('account' in value) ||
          !value.account ||
          typeof value.account !== 'object' ||
          !('status' in value.account) ||
          typeof value.account.status !== 'string' ||
          !['ACTIVE', 'STUB'].includes(value.account.status)
        )
          throw new Error('Invalid current account');
        return ok({
          identityId: value.identityId,
          name: value.profile.name ?? '',
        });
      }),
      catchError(() =>
        of(
          err(
            new Error(
              'Your current account could not be verified. No deletion request was sent.'
            )
          )
        )
      )
    );
  }
  request(identityId: string) {
    return defer(() => {
      if (!isCanonicalIdentityId(identityId))
        throw new Error('Invalid account');
      return this.http.delete<unknown>(this.url, {
        context: this.context(),
        observe: 'response',
      });
    }).pipe(
      timeout(15_000),
      map((response) => {
        const value = accountExportObject(response.body, [
          'identityId',
          'revision',
          'status',
          'cleanup',
        ]);
        if (
          response.status !== 202 ||
          value['identityId'] !== identityId ||
          value['status'] !== 'accepted' ||
          typeof value['revision'] !== 'number' ||
          !Number.isSafeInteger(value['revision']) ||
          value['revision'] < 1 ||
          (value['cleanup'] !== 'pending' &&
            value['cleanup'] !== 'completed' &&
            value['cleanup'] !== 'failed')
        )
          throw new Error('Invalid deletion acceptance');
        const accepted: AccountErasureAcceptance = {
          identityId,
          revision: value['revision'],
          status: 'accepted',
          cleanup: value['cleanup'],
        };
        return ok(accepted);
      }),
      catchError(() =>
        of(err(new Error('The deletion request could not be confirmed.')))
      )
    );
  }
}

export function accountErasureEndpoint(apiUrl: string): string {
  if (apiUrl) {
    const url = new URL(apiUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error('Invalid account erasure API origin');
  }
  return apiUrl.replace(/\/$/, '') + '/api/me';
}
