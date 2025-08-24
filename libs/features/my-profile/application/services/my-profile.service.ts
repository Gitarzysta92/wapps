import { inject, Injectable } from "@angular/core";
import { iif, map, merge, Observable, Subject, switchMap, tap } from "rxjs";
import { GuestProfileDto, MyProfileDto } from "../models";
import { Result } from "../../../../utils/utility-types";
import { AUTHENTICATION_PROVIDER, GUEST_PROFILE_PROVIDER, MY_PROFILE_EVENT_LISTENERS, MY_PROFILE_PROVIDER, MY_PROFILE_UPDATER } from "../ports";

@Injectable()
export class MyProfileService {

  private readonly _authenticationProvider = inject(AUTHENTICATION_PROVIDER);
  private readonly _guestProfileProvider = inject(GUEST_PROFILE_PROVIDER);
  private readonly _myProfileProvider = inject(MY_PROFILE_PROVIDER);
  private readonly _myProfileUpdater = inject(MY_PROFILE_UPDATER);
  private readonly _eventListeners = inject(MY_PROFILE_EVENT_LISTENERS, { optional: true });
  private readonly _profileUpdated$ = new Subject<void>();

  public profile$: Observable<MyProfileDto | GuestProfileDto> =
    merge(
      this._authenticationProvider.isAuthenticated$,
      this._profileUpdated$.pipe(switchMap(() => this._authenticationProvider.isAuthenticated$))
    ).pipe(
      switchMap(a =>
        iif(() => !!a,
          this._myProfileProvider.getMyProfile().pipe(map(p => p.value)),
          this._guestProfileProvider.getGuestProfile().pipe(map(p => p.value))
        )),
    )

  public updateProfile(p: MyProfileDto): Observable<Result<boolean, Error>> {
    return this._myProfileUpdater.update(p)
      .pipe(tap(() => {
        this._profileUpdated$.next();
        this._eventListeners?.forEach(e => e.profileUpdated(p));
      }))
  }
  
}