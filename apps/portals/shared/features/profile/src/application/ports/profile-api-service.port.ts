import { Observable } from "rxjs";
import { IdentityDto } from "../models/identity.dto";

export interface IProfileApiService {
  getProfile(id: string): Observable<IdentityDto>;
  updateProfile(profile: IdentityDto): Observable<boolean>;
}
