import { Observable } from "rxjs";
import { MyProfileState } from "./my-profile.state";

export interface IMyProfileStateProvider {
  myProfile$: Observable<MyProfileState>;
}