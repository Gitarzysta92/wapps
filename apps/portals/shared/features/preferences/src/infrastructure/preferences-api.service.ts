import { inject, Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { 
  ICustomerPreferencesProvider, 
  ICustomerPreferencesUpdater,
  CustomerPreferencesDto,
  DEFAULT_CUSTOMER_PREFERENCES,
  DisplayPreferencesDto,
  ContentPreferencesDto,
  NotificationPreferencesDto,
  PrivacyPreferencesDto,
  AccessibilityPreferencesDto
} from '@domains/customer/preferences';
import { Result, ok } from '@standard';
import { PREFERENCES_API_BASE_URL_PROVIDER } from '../application/infrastructure-providers.port';

/**
 * Mock API service for preferences
 * TODO: Replace with actual HTTP calls when backend is ready
 */
@Injectable()
export class PreferencesApiService implements ICustomerPreferencesProvider, ICustomerPreferencesUpdater {
  private readonly _apiBaseUrl = inject(PREFERENCES_API_BASE_URL_PROVIDER);
  
  // In-memory storage for mock implementation
  private _preferences: CustomerPreferencesDto = { ...DEFAULT_CUSTOMER_PREFERENCES };

  getPreferences(): Observable<Result<CustomerPreferencesDto, Error>> {
    // Simulate API call with delay
    return of(ok(this._preferences)).pipe(delay(300));
  }

  updatePreferences(preferences: Partial<CustomerPreferencesDto>): Observable<Result<boolean, Error>> {
    this._preferences = { ...this._preferences, ...preferences };
    return of(ok(true)).pipe(delay(200));
  }

  updateDisplayPreferences(preferences: Partial<DisplayPreferencesDto>): Observable<Result<boolean, Error>> {
    this._preferences = {
      ...this._preferences,
      display: { ...this._preferences.display, ...preferences }
    };
    return of(ok(true)).pipe(delay(200));
  }

  updateContentPreferences(preferences: Partial<ContentPreferencesDto>): Observable<Result<boolean, Error>> {
    this._preferences = {
      ...this._preferences,
      content: { ...this._preferences.content, ...preferences }
    };
    return of(ok(true)).pipe(delay(200));
  }

  updateNotificationPreferences(preferences: Partial<NotificationPreferencesDto>): Observable<Result<boolean, Error>> {
    this._preferences = {
      ...this._preferences,
      notifications: { ...this._preferences.notifications, ...preferences }
    };
    return of(ok(true)).pipe(delay(200));
  }

  updatePrivacyPreferences(preferences: Partial<PrivacyPreferencesDto>): Observable<Result<boolean, Error>> {
    this._preferences = {
      ...this._preferences,
      privacy: { ...this._preferences.privacy, ...preferences }
    };
    return of(ok(true)).pipe(delay(200));
  }

  updateAccessibilityPreferences(preferences: Partial<AccessibilityPreferencesDto>): Observable<Result<boolean, Error>> {
    this._preferences = {
      ...this._preferences,
      accessibility: { ...this._preferences.accessibility, ...preferences }
    };
    return of(ok(true)).pipe(delay(200));
  }
}

