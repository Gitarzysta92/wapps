import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { IdentityDto } from "./models/identity.dto";
import { IdentityState, IDENTITY_DEFAULT_STATE } from "./models/profile.state";

@Injectable()
export class ProfileStateService {
  private readonly _state$ = new BehaviorSubject<IdentityState>(IDENTITY_DEFAULT_STATE);

  public get state() { return this._state$.value; }
  public get state$() { return this._state$.asObservable(); }

  public startIdentifying() {
    this._state$.next({
      ...this.state,
      isIdentifying: true
    });
  }

  public obtainIdentity(i: IdentityDto | null) {
    this._state$.next({
      ...this.state,
      isIdentifying: false,
      identity: i
    });
  }

  public dropIdentity() {
    this._state$.next({
      ...this.state,
      identity: null
    });
  }
}