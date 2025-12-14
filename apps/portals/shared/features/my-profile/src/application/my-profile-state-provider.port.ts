import { Observable } from "rxjs";
import { MyProfileState } from "./my-profile.state";
import { CustomerProfileDto } from '@domains/customer/profiles';

export interface IMyProfileStateProvider {
  myProfile$: Observable<MyProfileState>;
  getMyProfile(): CustomerProfileDto | null;
}