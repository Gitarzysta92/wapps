import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, defer, map, Observable, of } from 'rxjs';
import { err, ok, Result } from '@sdk/kernel/standard';
import {
  IClientIdentityProvider,
  ClientIdentityDto,
} from '@sdk/features/identity/libs/authentication';
import {
  IDENTITY_CONNECTION,
  identityApiError,
  identityEndpoint,
} from './identity-connection';

@Injectable()
export class IdentityApiService implements IClientIdentityProvider {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(IDENTITY_CONNECTION);

  getIdentity(): Observable<Result<ClientIdentityDto, Error>> {
    return defer(() =>
      this.http.get<{
        identityId: string;
        account: { status: string };
        profile: { name: string | null };
      }>(identityEndpoint(this.connection, 'account', '/api/me'))
    ).pipe(
      map((response) => {
        if (
          !response ||
          typeof response.identityId !== 'string' ||
          !response.identityId ||
          !['ACTIVE', 'STUB'].includes(response.account?.status) ||
          !response.profile ||
          (response.profile.name !== null &&
            typeof response.profile.name !== 'string')
        )
          throw new Error('The account service returned an invalid identity.');
        return ok({
          id: response.identityId,
          name: response.profile.name ?? '',
        });
      }),
      catchError((error) =>
        of(err(identityApiError(error, 'Your account could not be loaded.')))
      )
    );
  }
}

@Injectable()
export class DemoIdentityService implements IClientIdentityProvider {
  getIdentity(): Observable<Result<ClientIdentityDto, Error>> {
    return of(ok({ id: 'demo', name: 'Demo account' }));
  }
}
