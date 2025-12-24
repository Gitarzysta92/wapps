import { inject } from "@angular/core";
import { IMyProfileViewStateProvider } from "./my-profile-view-state-provider.port";
import { MY_PROFILE_STATE_PROVIDER } from "../application/my-profile-state-provider.token";
import { map } from "rxjs";
import { toSignal } from "@angular/core/rxjs-interop";

export class MyProfileViewStateService implements IMyProfileViewStateProvider {

  private readonly _myProfileStateProvider = inject(MY_PROFILE_STATE_PROVIDER);

  public readonly avatar = toSignal(this._myProfileStateProvider.myProfile$.pipe(
    map(r => r.data.avatar?.uri ?? null)
  ), { initialValue: null });

  public readonly name = toSignal(this._myProfileStateProvider.myProfile$.pipe(
    map(r => r.data.name ?? null)
  ), { initialValue: null });

  public readonly isLoading = toSignal(this._myProfileStateProvider.myProfile$.pipe( 
    map(r => r.isLoading)
  ), { initialValue: false });

  public readonly isError = toSignal(this._myProfileStateProvider.myProfile$.pipe( 
    map(r => r.isError)
  ), { initialValue: false });

  public readonly state = toSignal(this._myProfileStateProvider.myProfile$, { initialValue: { isLoading: false, isError: false, data: null! } }); 
}