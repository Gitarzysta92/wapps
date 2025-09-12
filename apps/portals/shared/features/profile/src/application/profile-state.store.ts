import { inject, Injectable } from "@angular/core";
import { switchMap } from "rxjs";
import { PROFILE_PROVIDER } from "./ports/profile-provider.token";


@Injectable()
export abstract class ProfileStateStore {
  private readonly _profileProvider = inject(PROFILE_PROVIDER);

  public get state() { return this._state$.value };


  public state$ = this._profileProvider.getProfile("default").pipe(
    switchMap(profile => this._profileProvider.getProfile(profile.id))
  );
}