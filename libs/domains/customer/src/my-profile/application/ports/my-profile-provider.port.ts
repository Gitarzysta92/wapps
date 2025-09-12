
import { Observable } from "rxjs";
import { Result } from "@standard";
import { MyProfileDto } from "../models/my-profile.dto";

export interface IMyProfileProvider {
  getMyProfile(): Observable<Result<MyProfileDto>>
}

