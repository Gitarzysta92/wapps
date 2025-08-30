import { inject, Injectable } from "@angular/core";

@Injectable()
export abstract class ProfileStateStore {

  // public get state() { return this._state$.value };
  // private readonly _identityProvider = inject(IDENTITY_PROVIDER);
  // private readonly _profileProvider = inject(PROFILE_PROVIDER);

  // public state$ = this._identityProvider.identity$.pipe(switchMap(i => this._profileProvider.getProfile(i.id)))


}