import { Injectable } from '@angular/core';
import { defer, Observable, of } from 'rxjs';
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
import { Result, ok, err } from '@foundation/standard';

type PreferencesPatch = { [K in keyof CustomerPreferencesDto]?: Partial<CustomerPreferencesDto[K]> };

export const PREFERENCES_STORAGE_KEY = 'wapps.preferences.v1';

// Merge known fields with defaults, including older records missing nested fields.
function restore<T>(defaults: T, value: unknown): T {
  if (Array.isArray(defaults)) return (Array.isArray(value) && value.every(item => typeof item === 'string') ? [...value] : [...defaults]) as T;
  if (defaults !== null && typeof defaults === 'object') {
    const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, restore(fallback, source[key])])) as T;
  }
  return typeof defaults === typeof value ? value as T : defaults;
}

/** Browser-local settings only. No remote account or delivery settings are changed. */
@Injectable()
export class PreferencesApiService implements ICustomerPreferencesProvider, ICustomerPreferencesUpdater {
  private read(): CustomerPreferencesDto {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    const preferences = restore(DEFAULT_CUSTOMER_PREFERENCES, raw ? JSON.parse(raw) : null);
    const display = preferences.display;
    if (!['light', 'dark', 'auto'].includes(display.theme)) display.theme = 'auto';
    if (!['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(display.dateFormat)) display.dateFormat = 'DD/MM/YYYY';
    if (!['grid', 'list'].includes(display.defaultView)) display.defaultView = 'grid';
    if (![10, 20, 50, 100].includes(display.itemsPerPage)) display.itemsPerPage = 20;
    return preferences;
  }

  getPreferences(): Observable<Result<CustomerPreferencesDto, Error>> {
    return defer(() => {
      try { return of(ok(this.read())); }
      catch { return of(err(new Error('Could not read preferences from this browser.'))); }
    });
  }

  updatePreferences(preferences: PreferencesPatch): Observable<Result<boolean, Error>> {
    return defer(() => {
      try {
        const current = this.read();
        const next = { ...current };
        for (const key of Object.keys(preferences) as (keyof CustomerPreferencesDto)[]) {
          Object.assign(next, { [key]: restore(current[key], { ...current[key], ...preferences[key] }) });
        }
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
        return of(ok(true));
      } catch { return of(err(new Error('Could not save preferences. Browser storage may be unavailable or full.'))); }
    });
  }
  updateDisplayPreferences(preferences: Partial<DisplayPreferencesDto>): Observable<Result<boolean, Error>> {
    return this.updatePreferences({ display: preferences });
  }
  updateContentPreferences(preferences: Partial<ContentPreferencesDto>): Observable<Result<boolean, Error>> {
    return this.updatePreferences({ content: preferences });
  }
  updateNotificationPreferences(preferences: Partial<NotificationPreferencesDto>): Observable<Result<boolean, Error>> {
    return this.updatePreferences({ notifications: preferences });
  }
  updatePrivacyPreferences(preferences: Partial<PrivacyPreferencesDto>): Observable<Result<boolean, Error>> {
    return this.updatePreferences({ privacy: preferences });
  }
  updateAccessibilityPreferences(preferences: Partial<AccessibilityPreferencesDto>): Observable<Result<boolean, Error>> {
    return this.updatePreferences({ accessibility: preferences });
  }
}
