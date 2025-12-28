import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { CustomerProfileDto } from '@domains/customer/profiles';
import { ProviderState } from '@standard';

export const USER_PROFILE_PROVIDER = new InjectionToken<IUserProfileProvider>('USER_PROFILE_PROVIDER');


export interface IUserProfileProvider {
  getProfile(id: string): Observable<ProviderState<CustomerProfileDto>>;
}