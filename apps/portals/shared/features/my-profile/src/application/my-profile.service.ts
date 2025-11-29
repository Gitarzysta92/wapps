import { inject, Injectable } from "@angular/core";
import { map, Observable, Subject, switchMap, tap } from "rxjs";
import { ProfileDto, MY_PROFILE_PROVIDER, MY_PROFILE_UPDATER } from "@domains/customer/profiles";
import { Result } from "@standard";
import { IMyProfileStateProvider } from "./my-profile-state-provider.port";
import { MyProfileState } from "./my-profile.state";

@Injectable()
export class MyProfileService implements IMyProfileStateProvider {

  private readonly _myProfileProvider = inject(MY_PROFILE_PROVIDER);
  private readonly _myProfileUpdater = inject(MY_PROFILE_UPDATER);
  private readonly _profileUpdated$ = new Subject<void>();

  public myProfile$: Observable<MyProfileState> = this._myProfileProvider.getMyProfile().pipe(
    map(p => p.ok ? p.value : {} as ProfileDto),
    switchMap(p => this._myProfileProvider.getMyProfile().pipe(map(p => p.ok ? p.value : {} as ProfileDto))),
    map(p => ({
      isLoading: false,
      isError: false,
      data: p
    }))
  );

  public updateProfile(p: ProfileDto): Observable<Result<boolean, Error>> {
    return this._myProfileUpdater.update(p)
      .pipe(tap(() => {
        this._profileUpdated$.next();
      }))
  }

  public getProfile(): Observable<ProfileDto> {
    return this.myProfile$.pipe(map(state => state.data));
  }
  
}