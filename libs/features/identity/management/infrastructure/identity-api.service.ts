import { Injectable } from '@angular/core';
import { IDENTITY_PROVIDER, IDENTITY_UPDATER, IIdentityProvider, IIdentityUpdater, IdentityDto } from '@domains/identity';
import { Result } from '@standard';
import { Observable, of } from 'rxjs';

@Injectable()
export class IdentityApiService implements IIdentityProvider, IIdentityUpdater {
  getIdentity(): Observable<Result<IdentityDto, Error>> {
    // TODO: Implement actual API call
    return of(Result.ok({} as IdentityDto));
  }

  updateIdentity(identity: IdentityDto): Observable<Result<boolean, Error>> {
    // TODO: Implement actual API call
    return of(Result.ok(true));
  }
}
