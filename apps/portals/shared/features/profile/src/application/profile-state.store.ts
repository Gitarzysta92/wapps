import { inject, Injectable } from "@angular/core";
import { BehaviorSubject, switchMap } from "rxjs";
import { PROFILE_PROVIDER } from "./ports/profile-provider.token";
import { ProfileDto } from "@domains/customer/profiles";

@Injectable()
export abstract class ProfileStateStore {
  private readonly _profileProvider = inject(PROFILE_PROVIDER);
  private readonly _state$ = new BehaviorSubject<ProfileDto | null>(null);

  public get state() { return this._state$.value; }

  public state$ = this._profileProvider.getProfile("default").pipe(
    switchMap(profile => this._profileProvider.getProfile((profile as any).id))
  );
}