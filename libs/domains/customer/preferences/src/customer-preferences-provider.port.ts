import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Result } from '@standard';
import { CustomerPreferencesDto } from './customer-preferences.dto';

/**
 * Port for providing customer preferences
 */
export interface ICustomerPreferencesProvider {
  getPreferences(): Observable<Result<CustomerPreferencesDto, Error>>;
}

export const CUSTOMER_PREFERENCES_PROVIDER = new InjectionToken<ICustomerPreferencesProvider>(
  'CUSTOMER_PREFERENCES_PROVIDER'
);

