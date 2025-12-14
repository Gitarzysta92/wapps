import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CustomerProfileDto } from '@domains/customer/profiles';
import { DEFAULT_PROFILE } from '@portals/shared/data';

@Injectable()
export class ProfileApiServiceAdapter {
  public getProfile(id: string): Observable<CustomerProfileDto> {
    // Mock implementation - replace with actual API call
    return of(DEFAULT_PROFILE);
  }

  public updateProfile(profile: CustomerProfileDto): Observable<boolean> {
    // Mock implementation - replace with actual API call
    return of(true);
  }
}
