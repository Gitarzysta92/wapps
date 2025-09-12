import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { OwnerDto } from "../../../../../../../libs/domains/catalog/ownership/src/models/owner.dto";
import { IdentityState, IDENTITY_DEFAULT_STATE } from "../../../../../../../libs/domains/catalog/ownership/src/models/profile.state";

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

  public obtainIdentity(i: OwnerDto | null) {
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