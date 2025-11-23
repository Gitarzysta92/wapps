import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { ProfileDto } from "@domains/customer/profiles";

@Injectable()
export class ProfileApiServiceAdapter {

  public getProfile(id: string): Observable<ProfileDto> {
    // Mock implementation - replace with actual API call
    return of({
      id: id,
      name: "Default User",
      email: "user@example.com",
      avatarUrl: "https://picsum.photos/seed/avatar/150/150"
    });
  }

  public updateProfile(profile: ProfileDto): Observable<boolean> {
    // Mock implementation - replace with actual API call
    return of(true);
  }
}