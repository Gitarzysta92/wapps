import { inject, Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { IProfileApiService } from "../application/ports/profile-api-service.port";
import { IdentityDto } from "../application/models/identity.dto";

@Injectable()
export class ProfileApiServiceAdapter implements IProfileApiService {

  public getProfile(id: string): Observable<IdentityDto> {
    // Mock implementation - replace with actual API call
    return of({
      id: id,
      name: "Default User",
      email: "user@example.com",
      avatarUrl: "https://via.placeholder.com/150"
    });
  }

  public updateProfile(profile: IdentityDto): Observable<boolean> {
    // Mock implementation - replace with actual API call
    return of(true);
  }
}