import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, switchMap } from 'rxjs';
import { USER_PROFILE_PROVIDER } from './profile-provider.token';
import { CustomerProfileDto } from '@domains/customer/profiles';

@Injectable()
export abstract class ProfileStateStore {
  private readonly _profileProvider = inject(USER_PROFILE_PROVIDER);
  private readonly _state$ = new BehaviorSubject<CustomerProfileDto | null>(
    null
  );

  public get state() {
    return this._state$.value;
  }

  public state$ = this._profileProvider
    .getProfile('default')
    .pipe(
      switchMap((profile) =>
        this._profileProvider.getProfile((profile as any).id)
      )
    );
}
