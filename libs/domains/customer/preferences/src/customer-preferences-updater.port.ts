import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Result } from '@standard';
import { 
  CustomerPreferencesDto, 
  DisplayPreferencesDto, 
  ContentPreferencesDto,
  NotificationPreferencesDto,
  PrivacyPreferencesDto,
  AccessibilityPreferencesDto
} from './customer-preferences.dto';

/**
 * Port for updating customer preferences
 */
export interface ICustomerPreferencesUpdater {
  updatePreferences(preferences: Partial<CustomerPreferencesDto>): Observable<Result<boolean, Error>>;
  updateDisplayPreferences(preferences: Partial<DisplayPreferencesDto>): Observable<Result<boolean, Error>>;
  updateContentPreferences(preferences: Partial<ContentPreferencesDto>): Observable<Result<boolean, Error>>;
  updateNotificationPreferences(preferences: Partial<NotificationPreferencesDto>): Observable<Result<boolean, Error>>;
  updatePrivacyPreferences(preferences: Partial<PrivacyPreferencesDto>): Observable<Result<boolean, Error>>;
  updateAccessibilityPreferences(preferences: Partial<AccessibilityPreferencesDto>): Observable<Result<boolean, Error>>;
}

export const CUSTOMER_PREFERENCES_UPDATER = new InjectionToken<ICustomerPreferencesUpdater>(
  'CUSTOMER_PREFERENCES_UPDATER'
);


