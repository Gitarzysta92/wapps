import { Observable } from 'rxjs';
import { Result } from '@sdk/kernel/standard';
import { CustomerPreferencesDto } from './customer-preferences.dto';

/**
 * Port for providing customer preferences
 */
export interface ICustomerPreferencesProvider {
  getPreferences(): Observable<Result<CustomerPreferencesDto, Error>>;
}
