import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { IProfileApiService } from "../../../../../../../libs/domains/customer/src/ports/profile-api-service.port";
import { OwnerDto } from "../../../../../../../libs/domains/catalog/ownership/src/models/owner.dto";

@Injectable()
export class ProfileApiServiceAdapter implements IProfileApiService {

  public getProfile(id: string): Observable<OwnerDto> {
    // Mock implementation - replace with actual API call
    return of({
      id: id,
      name: "Default User",
      email: "user@example.com",
      avatarUrl: "https://picsum.photos/seed/avatar/150/150"
    });
  }

  public updateProfile(profile: OwnerDto): Observable<boolean> {
    // Mock implementation - replace with actual API call
    return of(true);
  }
}