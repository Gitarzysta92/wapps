import { inject, Injectable } from "@angular/core";
import { map, Observable, Subject, switchMap, tap, startWith, shareReplay } from "rxjs";
import { CustomerProfileDto, MY_PROFILE_PROVIDER, MY_PROFILE_UPDATER } from "@domains/customer/profiles";
import { Result } from "@foundation/standard";
import { IMyProfileStateProvider } from "./my-profile-state-provider.port";
import { MyProfileState } from "./my-profile.state";

@Injectable()
export class MyProfileService implements IMyProfileStateProvider {

  private readonly _myProfileProvider = inject(MY_PROFILE_PROVIDER);
  private readonly _myProfileUpdater = inject(MY_PROFILE_UPDATER);
  private readonly _profileUpdated$ = new Subject<void>();
  private _myProfile: CustomerProfileDto | null = null;

  public reload(): void { this._profileUpdated$.next(); }

  public myProfile$: Observable<MyProfileState> = this._profileUpdated$.pipe(
    startWith(undefined),
    switchMap(() => this._myProfileProvider.getMyProfile()),
    map(result => ({
      isLoading: false,
      isError: !result.ok,
      data: result.ok ? result.value : this._myProfile ?? { id: '', name: '' }
    })),
    tap(state => { if (!state.isError) this._myProfile = state.data; }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public updateProfile(p: CustomerProfileDto): Observable<Result<boolean, Error>> {
    return this._myProfileUpdater.update(p)
      .pipe(tap(result => {
        if (result.ok && result.value) this._profileUpdated$.next();
      }))
  }

  public getProfile(): Observable<CustomerProfileDto> {
    return this.myProfile$.pipe(map(state => state.data));
  }

  public getMyProfile(): CustomerProfileDto | null {
    return this._myProfile;
  }
  
}