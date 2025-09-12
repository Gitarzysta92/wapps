import { InjectionToken } from "@angular/core";
import { Observable } from "rxjs";
import { OwnerDto } from "@domains/catalog/ownership";

export const PROFILE_API_SERVICE = new InjectionToken<IProfileApiService>('PROFILE_API_SERVICE');

export interface IProfileApiService {
  getProfile(id: string): Observable<OwnerDto>;
  updateProfile(profile: OwnerDto): Observable<boolean>;
}

